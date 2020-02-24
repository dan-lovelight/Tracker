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

function getQuoteOptions(catData) {

  //Filter out any apartment data
  catData = filterBusinessUnit(catData, 'Custom')

  // Count the number of options in the data
  let blindOptions = countNumberOfOptions(catData, 'Blinds')
  let curtainOptions = countNumberOfOptions(catData, 'Curtains')

  let options = {}

  // Create an object with an array for each option
  catData.forEach(furnishing => {

    // Add each option to the options object, creating a new key if required
    if (furnishing.option) { // handle undefined case
      furnishing.option in options ? options[furnishing.option].push(furnishing) : options[furnishing.option] = [furnishing]
    }

  })

  // Do we need to consolidate any options?
  // That is to say, are there multiple blind options, but only one curtain option for example?
  // If so we treat the single option as part of the second option too
  if (!(blindOptions === 0 || curtainOptions === 0 || blindOptions === curtainOptions)) {

    // Only get here if there are options

    // If there is a single blind option, this needs to be added the other options
    if (blindOptions === 1) {
      Object.keys(options).forEach(key => {
        if (key > 1) {
          options[1].forEach(furnishing => {
            if (furnishing.group === 'Blinds') {
              // Add flag to identify that we've added this in
              furnishing.repeated = true
              options[key].push(furnishing)
            }
          })
        }
      })
    }

    // If there is a single curtain option, this needs to be added the other options
    if (curtainOptions === 1) {
      Object.keys(options).forEach(key => {
        if (key > 1) {
          options[1].forEach(furnishing => {
            if (furnishing.group === 'Curtains') {
              // Add flag to identify that we've added this in
              furnishing.repeated = true
              options[key].push(furnishing)
            }
          })
        }
      })
    }

    // There are other edge case possibilities. Not handling these

  }

  // optionsArr looks like this
  // [
  //  [{},{},{}], (Option 1)
  //  [{},{},{}], (Option 2) etc
  // ]
  let optionsArr = Object.values(options) // Convert the options to an array

  return getPrettyQuoteOptions(optionsArr)

  function getPrettyQuoteOptions(quoteOptions) {

    optionsArr = quoteOptions.map(option => {

      let blinds = getBlindsList(option)
      let curtains = getCurtainsList(option)
      let shutters = getShuttersList(option)

      let cntTypes = 0
      if (blinds.length > 0) cntTypes++
      if (curtains.length > 0) cntTypes++
      if (shutters.length > 0) cntTypes++

      return {
        option: option[0].option,
        cntTypes: cntTypes,
        blinds: blinds,
        shutters: shutters,
        curtains: curtains
      }

    })

    return optionsArr

    // Take an array of furnishings from CAT csv
    // Return an array of blinds with key fields
    function getBlindsList(arrayOfFurnishings) {

      // Blinds defined as: Group = Blind, Class = Blind || Motor
      // Get all the blinds
      let blindsList = arrayOfFurnishings.filter(furnishing => furnishing.group === 'Blinds' && (furnishing.class === 'Blind' || furnishing.class === 'Motor'))

      // clean the list of blinds
      blindsList = blindsList.map(blind => {

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
          fabricDetail = toTitleCase(`Room side: ${blind.room_fabric} ${roomColour} | Window side: ${blind.window_fabric} ${windowColour}`)
        } else {
          fabricDetail = fabricSummary
        }

        // **Blinds we need the following fields:
        // 1. type - if 'motor' is Y = 'motorised' plus type field, other wise just type field
        // 2. fabric_summary - concatenate room_fabric and room_colour, with special case for dual rollers
        // 3. fabric_detail - as above for single, but with room/window info for duals
        // 4. window_ref
        // 5. location
        // 6. linkage
        // 7. qty
        // 8. cost_price
        // 9. sell_price_ex_gst

        let summary = {
          type_display: blind.motor === 'Y' ? 'Motorised ' + toTitleCase(blind.type) : toTitleCase(blind.type),
          fabric_summary: fabricSummary,
          fabric_details: fabricDetail,
        }

        Object.entries(blind).forEach(([key, value]) => {
            summary[key] = value
        })

        return summary

      })

      return blindsList
    }

    // Take an array of furnishings from CAT csv
    // Return an array of curtains with key fields
    function getCurtainsList(arrayOfFurnishings) {

      // Curtains defined as: Group = Curtains
      // Get all the blinds
      let curtainsList = arrayOfFurnishings.filter(furnishing => furnishing.group === 'Curtains')

      // **Curtains we need the following fields:
      // 1. type
      // 2. fabric_summary - concatenate room_fabric and room_colour
      // 4. window_ref
      // 5. location
      // 6. qty
      // 7. cost_price
      // 8. sell_price_ex_gst

      curtainsList = curtainsList.map(curtain => {

        let summary = {
          fabric_summary: toTitleCase(`${curtain.room_fabric} - ${curtain.room_colour}`),
        }

        Object.entries(curtain).forEach(([key, value]) => {
            summary[key] = value
        })

        return summary

      })

      return curtainsList
    }

    // Take an array of furnishings from CAT csv
    // Return an array of shutters with key fields
    function getShuttersList(arrayOfFurnishings) {

      // Shutters defined as: Group = Blind, Class = Shutter
      // Get all the shutters
      let shuttersList = arrayOfFurnishings.filter(furnishing => furnishing.group === 'Blinds' && furnishing.class === 'Shutter')

      // **Shutters we need the following fields:
      // 1. type
      // 2. fabric_summary - concatenate room_fabric and room_colour
      // 4. window_ref
      // 5. location
      // 6. panels
      // 7. shaped
      // 8. black
      // 9. qty
      // 10. cost_price
      // 11. sell_price_ex_gst

      shuttersList = shuttersList.map(shutter => {

        let summary = {
          fabric_summary: toTitleCase(`${shutter.room_fabric} - ${shutter.room_colour}`),
        }

        Object.entries(shutter).forEach(([key, value]) => {
            summary[key] = value
        })

        return summary

      })
      return shuttersList
    }
  }
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
        let furnishingSubType = furnishing.type

        // We need to know where in the rows array this subType is positioned
        let subTypeIndex = -1

        if (rows.length > 0) {
          // Find the subtypes position
          subTypeIndex = rows.findIndex(row => row.data.name === furnishingSubType)
        }

        // If the subType row has already been created, update the data
        if (subTypeIndex > -1) {
          let subTypeRow = rows[subTypeIndex]
          subTypeRow.data.price = subTypeRow.data.price + parseFloat(furnishing.sell_price_ex_gst)
          subTypeRow.data.cost = subTypeRow.data.cost + parseFloat(furnishing.cost_price)
          subTypeRow.custom_fields["Quantity"] = subTypeRow.custom_fields["Quantity"] + parseFloat(furnishing.qty)
        }

        // Otherwise create a new row for this subType
        else {

          let row = {
            "options": {
              "multichoice_selected": false
            },
            "data": {
              "name": furnishing.type,
              "price": parseFloat(furnishing.sell_price_ex_gst),
              "cost": parseFloat(furnishing.cost_price),
              "qty": 1, // This is a summary row. Price & cost increment. Qty fixed at 1 (as it otherwise is used to multiply out price)
              "tax_first": {
                "value": 10,
                "type": "percent"
              }
            },
            "custom_fields": {
              "Quantity": parseFloat(furnishing.qty)
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
          "name": furnishing.type,
          "price": parseFloat(furnishing.sell_price_ex_gst),
          "cost": parseFloat(furnishing.cost_price),
          "qty": 1, // Because each furnishing is listed
          "tax_first": {
            "value": 10,
            "type": "percent"
          }
        },
        "custom_fields": {}
      }

      let blindFields = ['fabric_details', 'fabric_summary', 'location', 'window_ref', 'room_fabric', 'room_colour', 'window_fabric','window_colour', 'width', 'drop', 'linkage']
      let curtainFields = ['fabric_summary', 'room_fabric', 'room_colour', 'location', 'window_ref', 'width', 'drop', 'heading', 'open_direction', 'operation', 'fixing', 'side_hems', 'hems', 'track', 'track_colour' ]
      let shutterFields = ['fabric_summary', 'room_fabric', 'room_colour', 'location', 'window_ref', 'width', 'drop', 'panels', 'black_shutter', 'shaped_shutter']

      Object.entries(furnishing).forEach(([key, value]) => {

        let includeField = false

        switch(type){
          case 'blinds':
            if(blindFields.includes(key)) includeField = true
          break
          case 'curtains':
            if(curtainFields.includes(key)) includeField = true
            if(key === 'room_fabric') key = 'fabric'
            if(key === 'room_colour') key = 'colour'
          break
            case 'shutters':
            if(shutterFields.includes(key)) includeField = true
            if(key === 'room_fabric') key = 'product'
            if(key === 'room_colour') key = 'colour'
          break
        }

        if(includeField){
          row.custom_fields[toTitleCase(key.replace(/_/g, ' '))] = value
          }

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

function buildPricingTableArray(catData) {

  let quoteOptions = getQuoteOptions(catData)

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

    let response = await fetch(url, params)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }
}

// returns the number of options for the given blind them
// type can be either 'blinds' or 'curtains'
// if type is blank considers all furnishings
function countNumberOfOptions(catData, type) {
  let options = new Set()
  catData.forEach(furnishing => {
    if (furnishing.group.toLowerCase() === type.toLowerCase()) {
      options.add(furnishing.option)
    }
  })
  return options.size
}

// Filter CAT data to only include the required business unit
// Should be handled in upload, but this is an additional check
function filterBusinessUnit(catData, businessUnit){
  return catData.filter(furnishing => furnishing.business_unit.toLowerCase() === businessUnit.toLowerCase())
}
