$(document).on('knack-cell-update.view_1564', function(event, view, data) {
  console.log('caught 1564')
})

$(document).on('knack-view-render.any', function(event, view, data) {
  try {
    let opportunity
    let user = Knack.getUserAttributes()

    if (view.source) {
      if (view.source.object) {
        if (view.source.object === 'object_17') {
          opportunity = new KnackObject(view.source.object, view)
          opportunity.onChange(globalOpportunityChange)
        }
      }
    }

    function globalOpportunityChange(view, record, action, fields, recordBefore, changes) {
      let data = {}
      let isStatusUpdated = changes.includes('field_127')
      let isQuoteStatusUpdated = changes.includes('field_1606')

      // Record the status change date
      if (isStatusUpdated) {
        data.field_1609 = {
          "date": moment().format("DD/MM/YYYY"),
        }
        // Has status become 'To Quote'?
        if(record.field_127 === "To Quote") {
          data.field_1606 === "Open" // Set the 'Quote Status' to Open
        }
      }
      // Record the date the quoted status changed (eg Open/Pending)
      if (isQuoteStatusUpdated) {
        data.field_1610 = {
          "date": moment().format("DD/MM/YYYY"),
        }
      }
      // Update the record if a change has taken place
      if (isQuoteStatusUpdated || isStatusUpdated) {
        opportunity.update(record.id, data)
      }
    }

  } catch (error) {
    updateLog(`Opportunity error: \`\`\`${error.message}\n${error.stack}\`\`\``)
  }
})


const opportunityUpdatedEvents = [
  'knack-record-create.view_934', //https://builder.knack.com/lovelight/tracker#pages/scene_413/views/view_934
  'knack-record-create.view_1542', //https://builder.knack.com/lovelight/tracker#pages/scene_691/views/view_1542, //https://lovelight.knack.com/tracker#opportunities/new-quote-request/
  'knack-form-submit.view_1069', //https://builder.knack.com/lovelight/tracker#pages/scene_475/views/view_1069
  'knack-form-submit.view_87', //https://builder.knack.com/lovelight/tracker#pages/scene_49/views/view_87
  'knack-form-submit.view_949', //https://builder.knack.com/lovelight/tracker#pages/scene_414/views/view_949
  'knack-form-submit.view_950', //https://builder.knack.com/lovelight/tracker#pages/scene_415/views/view_950
  'knack-form-submit.view_1023', //https://builder.knack.com/lovelight/tracker#pages/scene_455/views/view_1023
  'knack-form-submit.view_1024', //https://builder.knack.com/lovelight/tracker#pages/scene_456/views/view_1024
  'knack-form-submit.view_1661', //https://builder.knack.com/lovelight/tracker#pages/scene_456/views/view_1661
]

$(document).on(opportunityUpdatedEvents.join(' '), function(event, view, record) {
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_691/views/view_1542
//https://lovelight.knack.com/tracker#opportunities/new-quote-request/
$(document).on('knack-record-create.view_1542', function(event, view, record) {
  triggerZap('lq798w', record, 'new quote request')
});

function processOpportunityChanges(record) {

  //Set variables
  var quotedNotificationValue = 50000;
  var saleNotificationValue = 10000;

  //Gather required data & variables

  //If we have to update the opportuinty, we'll need this:
  var updateOpp = {};
  updateOpp.field_258 = record.field_127; //set's the previous status field to the current status, removing the 'has chagned' flag

  //Set general variables to use in code below and make it more readable
  var status = record.field_127;
  var statusPrevious = record.field_258;
  var statusChanged = record.field_259;
  var value = record.field_128.length > 0 ? parseInt(record.field_128_raw.replace(/\,/g, '')) : undefined;
  var salesPerson = record.field_1274.length > 0 ? record.field_1274_raw["0"].identifier : undefined;
  var quotedBy = record.field_1275.length > 0 ? record.field_1275_raw["0"].identifier : salesPerson;
  var company = record.field_1460.length > 0 ? record.field_1460_raw["0"].identifier : undefined;
  var state = record.field_117;

  //If we need to trigger zaps, they'll need this information
  var zapierData = {};
  zapierData.status = status;
  zapierData.opportunity = record.field_123_raw;
  zapierData.value = value;
  zapierData.value_formatted = record.field_128_raw ? record.field_128_raw.split(".")[0] : value
  zapierData.salesPerson = salesPerson;
  zapierData.quotedBy = quotedBy;
  zapierData.company = company;

  console.log(status, statusPrevious, statusChanged, value, salesPerson, quotedBy, company);

  if (statusChanged == 'Yes') {

    //Has this opportunity just been quoted?
    if (status == 'Open' && statusPrevious !== 'Lost' && statusPrevious !== 'Won' && value >= quotedNotificationValue && typeof quotedBy !== 'undefined') {
      //Send to Zapier for Slack update
      triggerZap('l5tgdk', zapierData, 'Quote!');
    }

    if (status == 'Won') {
      //Add closed date to opportunity update object
      updateOpp.field_132 = moment().format("DD/MM/YYYY h:mm a");
      //console.log("status Changed to won "+ updateOpp.field_132);

      if (value >= saleNotificationValue) {

        if (salesPerson.indexOf('Jeremy') === -1) {
          zapierData.salesPersonCredit = salesPerson;
        } else {
          zapierData.salesPersonCredit = quotedBy
        }

        //console.log("value is >1000, credit to "+ zapierData.salesPersonCredit);

        //Send to Zapier for Slack update
        triggerZap('l5tx9j', zapierData, 'Sale!');

      } //end value>1000

      //Notify QLD channel about all wins
      if (state == 'QLD' && value < saleNotificationValue) {
        zapierData.salesPersonCredit = salesPerson;
        triggerZap('e337ri', zapierData, 'QLD Sale!');
      }

      //Does this opportunity have a company?
      if (typeof company !== 'undefined') {

        //console.log("there is a company");
        triggerZap('l5hoyo', zapierData, 'Opportunity has a company');

      } //end company
    } //end won

    //The status has changed. Set previous status to current status to reset the flag
    updateRecordPromise('object_17', record.id, updateOpp)

  } //end status changed
}
