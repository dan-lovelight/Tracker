async function generateQuote(uploadFieldId, opportunityId) {

  // Build the JSON template for the document
  // With all relevant meta data
  let pandaDoc = await getPandaDocGeneralDetails(opportunityId)

  // Combine the above with the uploaded details from CAT
  // to generate a quote in Panda Docs
  getCSVFromField(uploadFieldId, createQuoteInPandaDocs)


  async function createQuoteInPandaDocs(uploadedCsvData){
    // Convert the csv data to JSON
    let uploadedData = csvJSON(uploadedCsvData)

    // Filter out any apartment data
    uploadedData = filterBusinessUnit(uploadedData, 'Custom')

    // Get processed Data
    let quoteOptions = getProcessedQuoteData(uploadedData)

    // Build pricing talbes from the data
    let pricingTables = buildPricingTableArray(quoteOptions)

    // Add the pricing tables to the scheme
    pandaDoc.pricing_tables = pricingTables

    // Get quote specific tokens
    let quoteTokens = getQuoteTokens(quoteOptions)

    // Add tokens to schema
    pandaDoc.tokens = pandaDoc.tokens.concat(quoteTokens)

    // generate the quote
    let quote = await createPandaDoc(pandaDoc)
    // redirect the user to the quote
    window.open(`https://app.pandadoc.com/a/#/document/v1/editor/${quote.id}/content`, "_blank")
  }

}

async function getPandaDocGeneralDetails(opportunityId){

  const DEFAULT_SALES_PORTRAIT = 'https://cdn.business2community.com/wp-content/uploads/2017/08/blank-profile-picture-973460_640.png'

  // Get the full assocaited opportunity details
  let oppObject = new KnackObject(objects.opportunities)
  let opportunity = await oppObject.get(opportunityId)

  // Use the opportunity details to get the client and salesperson details
  let contactObj = new KnackObject(objects.contacts)
  let salesObj = new KnackObject(objects.salespeople)
  let gettingClient = contactObj.get(opportunity.field_119_raw[0].id)
  let gettingSalesperson = salesObj.get(opportunity.field_1274_raw[0].id)
  let client = await gettingClient
  let salesperson = await gettingSalesperson

  let pandaDoc = {
    "name": `${opportunity.field_123} - ${$('#field_1671')[0].value}`,
    "template_uuid": $('#view_2422-field_1672')[0].value.split('templateId')[1].split('"')[1],
    "recipients": [{
      "email": client.field_76_raw.email,
      "first_name": client.field_108_raw.first,
      "last_name": client.field_108_raw.last,
      "role": "client"
    }],
    "tokens": [{
        "name": "sales.Name",
        "value": salesperson.field_956
      },
      {
        "name": "sales.FirstName",
        "value": salesperson.field_1404
      },
      {
        "name": "sales.Email",
        "value": salesperson.field_957_raw.email
      },
      {
        "name": "sales.Mobile",
        "value": salesperson.field_1602_raw.number
      },
      {
        "name": "quote.QuotedBy",
        "value": opportunity.field_1275_raw[0].identifier
      },
      {
        "name": "quote.SiteAddress",
        "value": `${opportunity.field_121_raw.street}${opportunity.field_121_raw.street2 === "" ? "" : " " + opportunity.field_121_raw.street2} ${opportunity.field_121_raw.city}`
      },
      {
        "name": "quote.Business",
        "value": opportunity.field_1460_raw && opportunity.field_1460_raw.length > 0 ? opportunity.field_1460_raw[0].identifier : ''
      },
      {
        "name": "quote.Version",
        "value": $('#field_1671')[0].value
      },
      {
        "name": "quote.Name",
        "value": opportunity.field_123
      }
    ],
    "fields": {
      "client.name": {
        "value": `${client.field_108_raw.first} ${client.field_108_raw.last}`,
        "title": "Name"
      },
      "date": {
        "value": '',
        "title": "Date"
      }},
    "images": [{
      "name": "TextBlock1",
      "urls": [
        salesperson.field_1675_raw ? salesperson.field_1675_raw.url : DEFAULT_SALES_PORTRAIT
      ]
    }],
    "metadata": {
      "opportunityId": opportunity.id,
      "clientId": client.id,
      "businessId": opportunity.field_1460_raw && opportunity.field_1460_raw.length > 0 ? opportunity.field_1460_raw[0].id : ''
    },
    "tags": [
      opportunity.field_118.toLowerCase(),
      opportunity.field_117.toLowerCase(),
      "quote",
      getCurrentFiscalYear(),
      getCurrentFiscalQuarter()
    ]
  }
  return pandaDoc
}

// -------------------------------------------
// Takes a JSON object generated from a CAT csv export
// Turns this into an array of options being offered to the customer
// Each option in the array is an object:
// [{
//   option: 1,
//   cntTypes : 2,
//   blinds : [],
//   curtains : [],
//   shutters : []
// }]

function getProcessedQuoteData(catData) {

  let quote = catData.reduce((quoteDetails, lineItem) => {

    let quoteOption = lineItem.option
    let isBlind = lineItem.group === 'Blinds' && (lineItem.class === 'Blind' || lineItem.class === 'Motor')
    let isCurtain = lineItem.group === 'Curtains'
    let isShutter = lineItem.group === 'Blinds' && lineItem.class === 'Shutter'

    let requiredFields = ['location', 'width', 'drop', 'room_colour', 'room_fabric', 'window_ref', 'sell_price_ex_gst', 'cost_price', 'qty']
    let blindFields = ['fabric_detail', 'fabric_summary', 'window_fabric','window_colour', 'linkage']
    let curtainFields = ['type', 'heading', 'open_direction', 'operation', 'fixing', 'side_hems', 'hems', 'track', 'track_colour' ]
    let shutterFields = ['type', 'panels', 'black_shutter', 'shaped_shutter']

    // Get furnishing specific details
    let details = {}
    let furnishingKey = ''
    if (isBlind) {
      details = getBlindSpecificDetails(lineItem)
      furnishingKey = 'blinds'
      requiredFields = requiredFields.concat(blindFields)
    } else if (isCurtain) {
      details = getCurtainSpecificDetails(lineItem)
      furnishingKey = 'curtains'
      requiredFields = requiredFields.concat(curtainFields)
    } else if (isShutter) {
      details = getShutterSpecificDetails(lineItem)
      furnishingKey = 'shutters'
      requiredFields = requiredFields.concat(shutterFields)
    }

    // Build an object to hold all the furnishing details
    let furnishingData = {}
    Object.entries(lineItem).forEach(([key, value]) => {
      // check if we want the field
      if(requiredFields.includes(key)){
        // modify field name if necessary
        if(isCurtain && key === 'room_fabric') key = 'fabric'
        if(isCurtain && key === 'room_colour') key = 'colour'
        if(isShutter && key === 'room_fabric') key = 'product'
        if(isShutter && key === 'room_colour') key = 'colour'
        // convert key
        furnishingData[toTitleCase(key.replace(/_/g, ' '))] = value
      }
    })
    // Add the furnishing specific details
    Object.entries(details).forEach(([key, value]) => {
      furnishingData[key] = value
    })

    if (quoteOption in quoteDetails) {
      let thisOption = quoteDetails[quoteOption]
      // Add to furnishginData if option key exists
      thisOption[furnishingKey].push(furnishingData)
      // Update furnishings count
      thisOption.cntTypes = 0
      if (thisOption.blinds.length > 0) thisOption.cntTypes++
      if (thisOption.curtains.length > 0) thisOption.cntTypes++
      if (thisOption.shutters.length > 0) thisOption.cntTypes++
    } else {
      // Otherwise create the key
      quoteDetails = {
        [quoteOption] : {
          option: quoteOption.match(/\d+/g).join(''),
          cntTypes: 1,
          blinds: [],
          shutters: [],
          curtains: []
      }}
      // add the furnishing data
      quoteDetails[quoteOption][furnishingKey] = [furnishingData]
    }

    return quoteDetails

  }, {})

  // convert object to an array
  quote = Object.values(quote)

  if(quote.length>1){
    alert("This process currently only handles a single quote option")
    return
  } {
    return quote
  }
}


function getQuoteTokens(optionsArr){

  let tokens = [
    'blinds.products',
    'blinds.fabrics',
    'blinds.colours',
    'curtains.products',
    'curtains.fabrics',
    'curtains.colours',
    'curtains.headings',
    'curtains.hems',
    'shutters.types',
    'shutters.products',
    'shutters.colours',
  ]

  // Build tempory object to hold the value of each of these tokens
  // {
  //  'blinds.products': Set,
  //  blinds.fabrics': Set,
  //  etc
  // }
  tokens = tokens.reduce((allTokens, thisToken)=>{
    allTokens[thisToken] = new Set()
    return allTokens
  },{})

  optionsArr.map(option=>{

    option.blinds.map(blind=>{
      tokens['blinds.products'].add(blind["Type"])
      tokens['blinds.fabrics'].add(blind["Room Fabric"])
      tokens['blinds.fabrics'].add(blind["Window Fabric"])
      tokens['blinds.colours'].add(blind["Room Colour"])
      tokens['blinds.colours'].add(blind["Window Colour"])
    })

    option.curtains.map(curtain=>{
      tokens['curtains.products'].add(curtain["Type"])
      tokens['curtains.fabrics'].add(curtain["Fabric"])
      tokens['curtains.colours'].add(curtain["Colour"])
      tokens['curtains.headings'].add(curtain["Heading"])
      tokens['curtains.hems'].add(`Hems: ${curtain["Hems"]}`)
      tokens['curtains.hems'].add(`Side hems: ${curtain["Side Hems"]}`)
    })

    option.shutters.map(shutter=>{
      tokens['shutters.types'].add(shutter["Type"])
      tokens['shutters.products'].add(shutter["Product"])
      tokens['shutters.colours'].add(shutter["Colour"])
    })

  })

  let result = []

  Object.entries(tokens).forEach(([key, value]) => {
      result.push(
        {
          "name": key,
          "value": Array.from(value).filter(detail => detail !== '').join(', ')
        }
      )
  })

  return result

}

// -------------------------------------------
// Turn an array of options being offered to the customer into a Pricing Table
// This pricing table is a quote, consolidating all furnishings to give a price
function buildQuotePricingTable(optionsArr, tableName) {

  return pricingTable = {
    "name": tableName,
    "options": {
      "currency": "AUD",
    },
    "sections": buildQuoteSections(optionsArr)
  }

  // Builds the sections required for a pricing table
  function buildQuoteSections(optionsArr) {

    // We now have all the data we need for detailed summary tables
    // What we now need is to consolidate the data for the pricing table
    // There are two variations required

    // If there is only one option, we can go ahead and build the pricing table
    // One section for each of blinds, curtains, shutters
    // Consolidate based on type

    // If there are multiple options, need to consolidate the entire option
    // Also need to consolidate the summary tables with sections for each options

    let sections = []

    // If there is only 1 option do this
    if (optionsArr.length === 1) {

      let blindsSection = buildFurnishingQuoteSection('blinds', optionsArr[0])
      let curtainsSection = buildFurnishingQuoteSection('curtains', optionsArr[0])
      let shuttersSection = buildFurnishingQuoteSection('shutters', optionsArr[0])

      if (blindsSection) sections.push(blindsSection)
      if (curtainsSection) sections.push(curtainsSection)
      if (shuttersSection) sections.push(shuttersSection)

      return sections

    } else {
      // There are options, need to condence each furnishing down into a one line optional price

      let sections = {
        "title": "Options",
        "default": true,
        "multichoice_enabled": true,
        "rows": []
      }

      optionsArr.forEach(option => {

        let data = {}

        option.blinds.forEach(sumOption)
        option.curtains.forEach(sumOption)
        option.shutters.forEach(sumOption)

        function sumOption(furnishing) {
          if (!data.name) {
            data.name = `Option ${option.option}`
            data.price = parseFloat(furnishing.sell_price_ex_gst)
            data.cost = parseFloat(furnishing.cost_price)
            data.qty = parseFloat(furnishing.qty)
            data.tax_first = {
              "value": 10,
              "type": "percent"
            }
          } else {
            data.price = data.price + parseFloat(furnishing.sell_price_ex_gst)
            data.cost = data.cost + parseFloat(furnishing.cost_price)
            data.qty = data.qty + parseFloat(furnishing.qty)
          }
        }

        sections.rows.push({
          "options": {
            "multichoice_selected": false
          },
          "data": data
        })

      })

      //console.log(sections)
      return [sections]

    }

    // returns a furnishing section for PandaDoc
    // takes an array of furnishings sourced from an options array
    // section determeined by the type 'blinds', 'curtains', or 'shutters'
    function buildFurnishingQuoteSection(type, quoteOption) {

      // Get an array of furnishings of the selected type for this option
      // eg a list of all the blinds being quoted
      let furnishingsArray = quoteOption[type]

      // If there are no furnishings of the type, return early
      if (furnishingsArray.length === 0) return

      // Create an array of rows for the section within the pricing table
      // For example:
      // "rows": [
      // 	{
      //   "options": {
      //     "multichoice_selected": false
      //   },
      //   "data": {
      //     "name": "Blinds",
      //     "price": 849,
      //     "cost": 500,
      //     "qty": 1,
      //     "tax_first": {
      //       "value": 10,
      //       "type": "percent"
      //     }
      //   },
      //   "custom_fields": {
      //     "quantity": "12"
      //   },{more},{more}
      // ]
      let rowsArray = furnishingsArray.reduce((rows, furnishing) => {

        // We're building a summary table
        // We need to group all similar furnishing subtypes together
        // Different subtypes could be 'Rollers', 'Dual Rollers', 'Motorised Rollers' etc
        let furnishingSubType = furnishing["Type"]

        // We need to know where in the rows array this subType is positioned
        let subTypeIndex = -1

        if (rows.length > 0) {
          // Find the subtypes position
          subTypeIndex = rows.findIndex(row => row.data.name === furnishingSubType)
        }

        // If the subType row has already been created, update the data
        if (subTypeIndex > -1) {
          let subTypeRow = rows[subTypeIndex]
          subTypeRow.data.price = subTypeRow.data.price + parseFloat(furnishing["Sell Price Ex Gst"])
          subTypeRow.data.cost = subTypeRow.data.cost + parseFloat(furnishing["Cost Price"])
          subTypeRow.custom_fields["Quantity"] = subTypeRow.custom_fields["Quantity"] + parseFloat(furnishing["Qty"])
        }

        // Otherwise create a new row for this subType
        else {

          let row = {
            "options": {
              "multichoice_selected": false
            },
            "data": {
              "name": furnishing["Type"],
              "price": parseFloat(furnishing["Sell Price Ex Gst"]),
              "cost": parseFloat(furnishing["Cost Price"]),
              "qty": 1, // This is a summary row. Price & cost increment. Qty fixed at 1 (as it otherwise is used to multiply out price)
              "tax_first": {
                "value": 10,
                "type": "percent"
              }
            },
            "custom_fields": {
              "Quantity": parseFloat(furnishing["Qty"])
            }
          }

          rows.push(row)
        }
        return rows
      }, [])

      return {
        "title": type === 'blinds' ? "Blinds" : type === 'curtains' ? "Curtains" : "Shutters", //This is the section title
        "default": optionsArr[0].cntTypes === 1 ? true : false,
        "multichoice_enabled": false,
        "rows": rowsArray
      }
    }
  }
}

function buildFurnishingPricingTable(optionsArr, tableName, furnishingType) {

  let sections = []

  // Loop through each of the options and list the furnishings
  // If there are multiple options list these under sections headings
  optionsArr.forEach(option => {
    // Get the section details
    let section = buildFurnishingDetailsSection(furnishingType, option)

    // If there is section data, add it to the sections array
    if (section) {

      // Add option number to title if there are options (multiple sections)
      if (optionsArr.length > 1) {
        section.title += ' & ' + option.option
      }

      // Set default to false if it's not the first option (section)
      if (sections.length > 0) {
        section.default = false
      }

      sections.push(section)
    }

  })

  // return early if there is no data - this furnishing is not being offered in any option
  if (sections.length === 0) return

  let pricingTable = {
    "name": tableName,
    "options": {
      "currency": "AUD",
    },
    "sections": sections
  }

  return pricingTable

  // returns a furnishing section for PandaDoc
  // takes an array of furnishings
  // section determeined by the type 'blinds', 'curtains', or 'shutters'
  function buildFurnishingDetailsSection(type, furnishings) {
    // Build the Shutters section of the pricing table
    if (furnishings[type].length === 0) return

    let formattedRows = furnishings[type].reduce((rows, furnishing) => {

      let row = {
        "options": {
          "multichoice_selected": false
        },
        "data": {
          "name": furnishing["Type"],
          "price": parseFloat(furnishing["Sell Price Ex Gst"]),
          "cost": parseFloat(furnishing["Cost Price"]),
          "qty": 1, // Because each furnishing is listed
          "tax_first": {
            "value": 10,
            "type": "percent"
          }
        },
        "custom_fields": {}
      }

      Object.entries(furnishing).forEach(([key, value]) => {
          row.custom_fields[key] = value
      })

      rows.push(row)

      return rows
    }, [])

    return {
      "title": type === 'blinds' ? `Blinds Option ${furnishings.option}` : type === 'curtains' ? `Curtains Option ${furnishings.option}` : `Shutters Option ${furnishings.option}`,
      "default": true,
      "multichoice_enabled": false,
      "rows": formattedRows
    }
  }
}

function buildPricingTableArray(quoteOptions) {

  let quoteTable = buildQuotePricingTable(quoteOptions, "PricingTable1")
  let blindsTable = buildFurnishingPricingTable(quoteOptions, "PricingTable2", 'blinds')
  let curtainsTable = buildFurnishingPricingTable(quoteOptions, "PricingTable3", 'curtains')
  let shuttersTable = buildFurnishingPricingTable(quoteOptions, "PricingTable4", 'shutters')

  let pricingTable = []
  if (quoteTable) pricingTable.push(quoteTable)
  if (blindsTable) pricingTable.push(blindsTable)
  if (curtainsTable) pricingTable.push(curtainsTable)
  if (shuttersTable) pricingTable.push(shuttersTable)

  return pricingTable
}

async function createPandaDoc(body) {
  try {
    let url = 'https://api.pandadoc.com/public/v1/documents'
    let params = {
      method: 'POST',
      headers: {
        'Authorization': 'API-Key 70d16339e0fe74a377cea7830b96734f34aed5b9',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }

    console.log(body)

    let response = await fetch(url, params)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }
}

// Filter CAT data to only include the required business unit
// Should be handled in upload, but this is an additional check
function filterBusinessUnit(catData, businessUnit) {
  return catData.filter(furnishing => furnishing.business_unit.toLowerCase() === businessUnit.toLowerCase())
}

function getBlindSpecificDetails(blind) {

  let fabricSummary
  let fabricDetail

  // Build the fabric summary
  if (blind.class === 'Motor') {
    fabricSummary = blind.room_fabric
  } else if (blind.type.indexOf('DUAL') > -1) {
    let roomColour = blind.room_colour ? `- ${blind.room_colour}` : ''
    let windowColour = blind.window_colour ? `- ${blind.window_colour}` : ''
    fabricSummary = `${blind.room_fabric} ${roomColour} & ${blind.window_fabric} ${windowColour}`
  } else {
    let colour = blind.room_colour ? `- ${blind.room_colour}` : ''
    fabricSummary = `${blind.room_fabric} ${colour}`
  }

  fabricSummary = toTitleCase(fabricSummary)

  // Build the fabric detailed description
  if (blind.type.indexOf('DUAL') > -1) {
    let roomColour = blind.room_colour ? `- ${blind.room_colour}` : ''
    let windowColour = blind.window_colour ? `- ${blind.window_colour}` : ''
    fabricDetail = toTitleCase(`Room: ${blind.room_fabric} ${roomColour} \n Window: ${blind.window_fabric} ${windowColour}`)
  } else {
    fabricDetail = fabricSummary
  }

  return {
    "Type": blind.motor === 'Y' ? 'Motorised ' + toTitleCase(blind.type) : toTitleCase(blind.type),
    "Fabric Summary": fabricSummary,
    "Fabric Detail": fabricDetail
  }

}

function getCurtainSpecificDetails(curtain) {

  return {
    "Fabric Summary": toTitleCase(`${curtain.room_fabric} - ${curtain.room_colour}`)
  }

}

function getShutterSpecificDetails(shutter) {

  return {
    "Fabric Summary": toTitleCase(`${shutter.room_fabric} - ${shutter.room_colour}`)
  }

}

// **************
// This was originally written to handle quote options. Revist later
// ****************

// if (countOptions > 1) {
//
//   // Count the number of options in the data
//   let blindOptions = countNumberOfOptions(catData, 'Blinds')
//   let curtainOptions = countNumberOfOptions(catData, 'Curtains')
//
//   // Do we need to consolidate any options?
//   // That is to say, are there multiple blind options, but only one curtain option for example?
//   // If so we treat the single option as part of the second option too
//   if (!(blindOptions === 0 || curtainOptions === 0 || blindOptions === curtainOptions)) {
//
//     // Only get here if there are options
//
//     // If there is a single blind option, this needs to be added the other options
//     if (blindOptions === 1) {
//       Object.keys(options).forEach(key => {
//         if (key > 1) {
//           options[1].forEach(furnishing => {
//             if (furnishing.group === 'Blinds') {
//               // Add flag to identify that we've added this in
//               furnishing.repeated = true
//               options[key].push(furnishing)
//             }
//           })
//         }
//       })
//     }
//
//     // If there is a single curtain option, this needs to be added the other options
//     if (curtainOptions === 1) {
//       Object.keys(options).forEach(key => {
//         if (key > 1) {
//           options[1].forEach(furnishing => {
//             if (furnishing.group === 'Curtains') {
//               // Add flag to identify that we've added this in
//               furnishing.repeated = true
//               options[key].push(furnishing)
//             }
//           })
//         }
//       })
//     }
//
//     // There are other edge case possibilities. Not handling these
//
//   }
// }
