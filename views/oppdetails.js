// https://lovelight.knack.com/tracker#custom-opportunities/view-opportunity-details/{}/upload-test/{}/
// modal for uploading file that is sent to Pandadoc to create quote
$(document).on('knack-scene-render.scene_1108', function(event, scene) {
  // Swap out action buttons
  $('#view_2422 .kn-submit').after('<a class="kn-button is-primary" id="load-file">Load File</a>')
  $('.kn-submit')[0].remove()

  // Process the file when button is clicked
  $('#load-file').click(function() {

    // Use the uploaded cat csv file and the opportunity id to generate a quote in pandadocs
    generateQuote('field_1673_upload', scene.scene_id)

  })

})

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

  const DEFAULT_SALES_PORTRAIT = 'https://www.lovelight.com.au/assets//Logo.png'

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
    "fields": {},
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

$(document).on('knack-scene-render.scene_414', function(event, scene) {

  // $('#view_1659').after('<div id="pandadoc-edit" class="pandadoc"></div>')
  $('#view_1659').after('<div id="pandadoc-list" class="pandadoc"></div>')
  // $('#view_1659 .control').append('<a class="kn-button" id="new-pandadoc">New Quote</a>')
  // $('#view_1659 .control').append('<a class="kn-button" id="load-file">Load File</a>')
  //
  // $('#new-pandadoc').on('click', function() {
  //   var editor = new PandaDoc.DocEditor();
  //   editor.showAsModal({
  //     el: '#pandadoc-edit',
  //     data: {
  //       metadata: {
  //         opportunityId: scene.scene_id
  //       }
  //     },
  //     cssClass: 'pandadoc',
  //     events: {
  //       onInit: function() {},
  //       onDocumentCreated: function() {},
  //       onDocumentSent: function() {},
  //       onClose: function() {
  //         location.reload()
  //       }
  //     }
  //   });
  // })

  var doclist = new PandaDoc.DocList({
    mode: PandaDoc.DOC_LIST_MODE.LIST
  });
  doclist.init({
    el: '#pandadoc-list',
    data: {
      docName: '',
      metadata: {
        opportunityId: scene.scene_id
      }
    },
    cssClass: 'pandadoc',
    events: {
      onInit: function() {},
      onDocumentCreate: function() {}
    }
  });

})
