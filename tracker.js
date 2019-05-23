const trackerObjects = [{
  name: 'jobs',
  object: 'object_3'
}, {
  name: 'callouts',
  object: 'object_78'
}, {
  name: 'installers',
  object: 'object_71'
}, {
  name: 'invoices',
  object: 'object_19'
},{
  name: 'orders',
  object: 'object_5'
},
{
  name: 'opportunities',
  object: 'object_17'
}
]

$(document).on('knack-view-render.any', function(event, scene) {
  var $submitButtonArray = $(".kn-submit input[type=submit]");
  $submitButtonArray.each(function(index) {
    var $submitButton = $(this);
    if ($submitButton.attr("value") === "Submit") {
      $submitButton.attr("value", "Save");
    }
  });
});

$(document).on('knack-page-render.any', function(event, page) {
  $(".kn-back-link a").html("<i class='fa fa-chevron-circle-left'></i> Previous");
});


//***************************************************************************
//******************* ADD LINKS TO MENU *************************************
//***************************************************************************

$(document).on('knack-scene-render.any', function(event, scene) {

  let userRoles = Knack.getUserRoles()

  if(Knack.getUserAttributes()!='No user found' && !(userRoles.length == 1 && userRoles[0] == 'object_71')){ // not logged in or an installer

    //Portal
    var myElem = document.getElementById('portal');
    if (myElem === null) {
      $("#app-menu-list").append("<li id='portal'><a href='https://portal.lovelight.com.au' target='_blank'>Portal</a></li>");
      $("#portal > a").css('background-color', '#dddddd');
    }

    //Xero
    myElem = document.getElementById('xero');
    if (myElem === null) {
      $("#app-menu-list").append("<li id='xero'><a href='https://go.xero.com/Dashboard/' target='_blank'>Xero</a></li>");
      $("#xero > a").css('background-color', '#048abb');
    }

    //Helpsite
    myElem = document.getElementById('help-centre');
    if (myElem === null) {
      $("#app-menu-list").append("<li id='help-centre'><a href='http://lovelight.helpsite.io/' target='_blank'>Helpsite</a></li>");
      $("#help-centre > a").css('background-color', '#07467c');
    }

    //Change colour of Templates Tab
    $("li > a > span:contains('Templates')").parent().css('background-color', '#217346');

  }
});

//***************************************************************************
//******************* HIDE EMPTY TABLES *************************************
//***************************************************************************

//My Opportunities dashboard
$(document).on('knack-scene-render.scene_246', function(event, scene) {
  hideEmptyTables(scene)
});

//My Jobs dashboard
$(document).on('knack-scene-render.scene_247', function(event, scene) {
  hideEmptyTables(scene)
});

//My Orders dashboard
$(document).on('knack-scene-render.scene_248', function(event, scene) {
  hideEmptyTables(scene)
});

//My Invoices dashboard
$(document).on('knack-scene-render.scene_249', function(event, scene) {
  hideEmptyTables(scene)
});

//My To Quote dashboard
$(document).on('knack-scene-render.scene_417', function(event, scene) {
  hideEmptyTables(scene)
});

//My Jobs
$(document).on('knack-scene-render.scene_1578', function(event, scene) {
  hideEmptyTables(scene)
});

//My Opportunities
$(document).on('knack-scene-render.scene_707', function(event, scene) {
  if (Knack.models["view_1583"].data.length == 0) {
    $('#view_1583').remove();
  }
  if (Knack.models["view_1640"].data.length == 0) {
    $('#view_1640').remove();
  }
  if (Knack.models["view_1641"].data.length == 0) {
    $('#view_1641').remove();
  }
});

//My Invoices
$(document).on('knack-scene-render.scene_720', function(event, scene) {
  hideEmptyTables(scene)
});

//Remakes
$(document).on('knack-scene-render.scene_956', function(event, scene) {
  hideEmptyTables(scene)
});
//Track Remakes
$(document).on('knack-scene-render.scene_959', function(event, scene) {
  hideEmptyTables(scene)
});

//***************************************************************************
//******************* ADD MULTISELECT STOCKTAKE FUNCTIONALITY ***************
//***************************************************************************

//Stocktake page
$(document).on('knack-view-render.view_1287', function(event, view) {

  // Add an update button
  $('<div style="padding:15px 15px 15px 0px"><a id="confirmStockTake" class="kn-button">Confirm Selected</a></div>').insertAfter($('#view_1287 .view-header'));

  // Add checkboxes to our table
  addCheckboxes(view);

  // Click event for the update button
  $('#confirmStockTake').click(function() {

    // We need an array of record IDs
    var record_ids = [];

    // Populate the record IDs using all checked rows
    $('#' + view.key + ' tbody input[type=checkbox]:checked').each(function() {
      record_ids.push($(this).closest('tr').attr('id')); // record id
    });

    let recordURL = 'https://api.knack.com/v1/objects/object_5/records/'
    let data = {}

    data.field_1001 = {
      "date": moment().format("DD/MM/YYYY"),
      "hours": moment().format("h"),
      "minutes": moment().format("mm"),
      "am_pm": moment().format("a"),
    }

    let recordRequestLoop = function(arrayOfIDs) {
      let promiseArray = [];
      for (let i = 0; i <= record_ids.length - 1; i++) {
        let targetRecord = recordURL + record_ids[i];
        promiseArray.push(fetch(targetRecord, {
          method: 'PUT',
          body: JSON.stringify(data),
          headers: myKnackHeaders
        }).then(function(response) {
          return response.json();
        }).then(function(json) {
          return json.id; //just need something to indicate it worked, don't care what
        })).catch(errorHandler)
      }
      return Promise.all(promiseArray);
    }

    //Show modal
    swal({
        text: 'Update stocktake date for ' + record_ids.length + " records?",
        //content: "input",
        button: {
          text: "Update Now",
          closeModal: false,
        },
      })
      .then(name => {
        return recordRequestLoop(record_ids);
      })
      .then(json => {
        swal({
          title: "Update complete",
          text: json.length + " records updated",
        });
      })
      .then(resp => {
        Knack.views["view_1287"].model.fetch();
      })
      .catch(err => {
        if (err) {
          swal("Something went wrong!", err, "error");
        } else {
          swal.stopLoading();
          swal.close();
        }
      });
  })
});

//***************************************************************************
//******************* ALL FORMS THAT UPDATE OPPORTUNITIES********************
//***************************************************************************

//******************* RECORD CREATED ****************************************

//Add Opportunity
//https://builder.knack.com/lovelight/tracker#pages/scene_413/views/view_934
$(document).on('knack-record-create.view_934', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_691/views/view_1542
//https://lovelight.knack.com/tracker#opportunities/new-quote-request/
$(document).on('knack-record-create.view_1542', function(event, view, record) {
  console.log(record);
  //Create ticket in ZD for new quote request
  sendHookToZapier('lq798w', record, 'new quote request')
  processOpportunityChanges(record);
});

//******************* FORM SUBMITTED ****************************************

//https://builder.knack.com/lovelight/tracker#pages/scene_475/views/view_1069
$(document).on('knack-form-submit.view_1069', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_49/views/view_87
$(document).on('knack-form-submit.view_87', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_414/views/view_949
$(document).on('knack-form-submit.view_949', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_415/views/view_950
$(document).on('knack-form-submit.view_950', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_455/views/view_1023
$(document).on('knack-form-submit.view_1023', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_456/views/view_1024
$(document).on('knack-form-submit.view_1024', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_456/views/view_1661
$(document).on('knack-form-submit.view_1661', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//***************************************************************************
//******************* WHEN AN OPPORTUNITY IS UPDATED ************************
//***************************************************************************
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
  zapierData.value_formatted = record.field_128_raw.split(".")[0];
  zapierData.salesPerson = salesPerson;
  zapierData.quotedBy = quotedBy;
  zapierData.company = company;

  console.log(status, statusPrevious, statusChanged, value, salesPerson, quotedBy, company);

  if (statusChanged == 'Yes') {

    //Has this opportunity just been quoted?
    if (status == 'Open' && statusPrevious !== 'Lost' && statusPrevious !== 'Won' && value >= quotedNotificationValue && typeof quotedBy !== 'undefined') {
      //Send to Zapier for Slack update
      sendHookToZapier('l5tgdk', zapierData, 'Quote!');
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
        sendHookToZapier('l5tx9j', zapierData, 'Sale!');

      } //end value>1000

      //Notify QLD channel about all wins
      if (state == 'QLD' && value < saleNotificationValue) {
        zapierData.salesPersonCredit = salesPerson;
        sendHookToZapier('e337ri', zapierData, 'QLD Sale!');
      }

      //Does this opportunity have a company?
      if (typeof company !== 'undefined') {

        //console.log("there is a company");
        sendHookToZapier('l5hoyo', zapierData, 'Opportunity has a company');

      } //end company
    } //end won

    //The status has changed. Set previous status to current status to reset the flag
    updateRecordByID('opportunities', record.id, updateOpp)

  } //end status changed
}

//***************************************************************************
//******************* ALL EVENTS THAT UPDATE JOBS ***************************
//***************************************************************************

//******************* RECORD CREATED ****************************************

// https://lovelight.knack.com/tracker#dashboard/jobs2/add-job/
// https://builder.knack.com/lovelight/tracker#pages/scene_18/views/view_33
$(document).on('knack-record-create.view_33', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});

// https://lovelight.knack.com/tracker#jobs/view-job-details
// https://builder.knack.com/lovelight/tracker#pages/scene_244/views/view_609
$(document).on('knack-record-create.view_609', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});

// https://lovelight.knack.com/tracker#custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity2
// https://builder.knack.com/lovelight/tracker#pages/scene_776/views/view_1671
$(document).on('knack-record-create.view_1671', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});

// https://lovelight.knack.com/tracker#custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity
// https://builder.knack.com/lovelight/tracker#pages/scene_776/views/view_1670
$(document).on('knack-record-create.view_1670', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});


//******************* FORM SUBMITTED ****************************************

//All My Jobs
//https://lovelight.knack.com/tracker#dashboard/jobs2/
//https://builder.knack.com/lovelight/tracker#pages/scene_247/views/view_277
$(document).on('knack-form-submit.view_277', function(event, view, record) {
  console.log(record);
});

//******************* INLINE EDITS ******************************************

//My Issue Jobs
//https://lovelight.knack.com/tracker#dashboard/jobs2/
//https://builder.knack.com/lovelight/tracker#pages/scene_247/views/view_402
$(document).on('knack-cell-update.view_402', function(event, view, record) {
  console.log(record);
});

//All My Jobs
//https://lovelight.knack.com/tracker#dashboard/jobs2/
//https://builder.knack.com/lovelight/tracker#pages/scene_247/views/view_277
$(document).on('knack-cell-update.view_277', function(event, view, record) {
  console.log(record);
});

//******************** CREATE JOB IN JOBREC ********************************

function addJobToJobRec (job) {
	let url = 'https://api.jobrecapp.com/v1/jobs/'
    let data = {
      'name': job.field_296,
      'source': 'Tracker',
      'sourceId': job.id,
      'ownerName': job.field_1276_raw[0].identifier,
      'ownerEmail': job.field_715,
      'url': 'https://lovelight.knack.com/tracker#jobs/view-job-details/' + job.id,
      'value': job.field_130_raw.replace(/,/g, ''),
      'client': job.field_1332
    }

    let init = {
        method: 'POST',
        headers: myJobRecHeaders,
        body: JSON.stringify(data)
      }

  return fetch(url, init)
}

//******************** VIEW JOB DETAILS ********************************
$(document).on('knack-scene-render.scene_52', function(event, scene) {
	hideEmptyTables(scene)
})

//***************************************************************************
//******************* ALL EVENTS THAT UPDATE ORDERS *************************
//***************************************************************************

//******************* RECORD CREATED ****************************************

//Add estimate
$(document).on('knack-record-create.view_1139', function(event, view, record) {
  processOrderChanges(record);
});

//Add order
$(document).on('knack-record-create.view_96', function(event, view, record) {
  processOrderChanges(record);
});

//Record Stock Usage
$(document).on('knack-record-create.view_1019', function(event, view, record) {
  processOrderChanges(record);
});

//Create Related Order
$(document).on('knack-record-create.view_1000', function(event, view, record) {
  processOrderChanges(record);
});

//******************* FORM SUBMITTED ****************************************

//Edit Estimate
$(document).on('knack-form-submit.view_1140', function(event, view, record) {
  processOrderChanges(record);
});

//Edit Order
$(document).on('knack-form-submit.view_223', function(event, view, record) {
  processOrderChanges(record);
});

//Change Order Status
$(document).on('knack-form-submit.view_997', function(event, view, record) {
  processOrderChanges(record);
});

//Update Storage Bay
$(document).on('knack-form-submit.view_1333', function(event, view, record) {
  processOrderChanges(record);
});

//Update Carton Number
$(document).on('knack-form-submit.view_1334', function(event, view, record) {
  processOrderChanges(record);
});

//Warehouse Change Order Status
$(document).on('knack-form-submit.view_1353', function(event, view, record) {
  processOrderChanges(record);
});

//******************* INLINE EDITS ******************************************

//Job details table
$(document).on('knack-cell-update.view_97', function(event, view, record) {
  processOrderChanges(record);
});

//Search Orders
$(document).on('knack-cell-update.view_1087', function(event, view, record) {
  processOrderChanges(record);
});

//Related orders table in order details
$(document).on('knack-cell-update.view_998', function(event, view, record) {
  processOrderChanges(record);
});

//Stocktake table
$(document).on('knack-cell-update.view_1287', function(event, view, record) {
  processOrderChanges(record);
});

//Deliver manifest table
$(document).on('knack-cell-update.view_1332', function(event, view, record) {
  processOrderChanges(record);
});

//Recently received table
$(document).on('knack-cell-update.view_1335', function(event, view, record) {
  processOrderChanges(record);
});

//******************* REMAKE PAGES ***************************************



//******************* ORDER FUNCTIONS ***************************************

function processOrderChanges(record) {

  console.log(record);

  //Set general variables to use in code below and make it more readable
  var status = record.field_442_raw["0"].identifier;
  var previousStatus = record.field_443.length > 0 ? record.field_443_raw["0"].identifier : undefined;
  var isStatusChanged = record.field_263;
  var isReceivedByBayEntry = status.includes("Ordered") && record.field_90.length > 0 ? true : false;
  var isReceived = isReceivedByBayEntry || (isStatusChanged && status.includes("Warehouse")) ? true : false;
  var today = moment().format("DD/MM/YYYY")
  var updateOrder = {}; //If we have to update the opportuinty, we'll need this:
  var data = {}; //For sending through to Zapier
  var bays = [];
  var bayNames = "";

  //Get bays incase they are needed
  if (typeof record.field_90_raw !== 'undefined') {
    for (var i = 0; i < record.field_90_raw.length; i++) {
      bays.push(record.field_90_raw[i].id);
      bayNames += record.field_90_raw[i].identifier;
      if (record.field_90_raw[i].id != record.field_90_raw[record.field_90_raw.length - 1].id) {
        bayNames += ', '
      }
    }
  }

  //Take action if status is changed
  if (isStatusChanged) {

    //We'll need to update these fields
    updateOrder.field_443 = record.field_442_raw["0"].id; //set's the previous status field to the current status, removing the 'has changed' flag
    updateOrder.field_264 = today; //status changed date
    updateOrder.field_1395 = 'processOrderChanges() function via Knack JS';

    //Has it just been recieved?
    if (isReceived) {
      //Set date received
      updateOrder.field_22 = today; //set to order received date to today
      updateOrder.field_247 = 'No'; //flag so that standard email gets sent (need to remove later)

      //Was it received implicitly by entering a bay?
      if (isReceivedByBayEntry) {
        //Change status to 'In Warehouse'
        updateOrder.field_442 = '59086d0d86d2272d7a9805db'
        updateOrder.field_443 = '59086d0d86d2272d7a9805db'
      }

      //Notify sales & ops that order has been received.
      data.orderID = record.id;
      data.jobID = record.field_10_raw["0"].id;
      data.bays = bayNames;
      data.supplier = record.field_1446_raw["0"].identifier;
      data.quantity = record.field_17;
      data.product = record.field_11_raw["0"].identifier;
      data.deliveryLocation = record.field_111;
      data.notes = record.field_18;
      data.status = status;

      console.log(status);
      console.log(data);

      sendHookToZapier('eak2n4', data, 'order received notification sent');

    }
  }

  //Was this record stocktake today?
  if (record.field_1001.length > 0) {
    if (record.field_1001_raw.date_formatted == today) {
      //Set the stocktake bay
      updateOrder.field_1000 = bays;
    }
  }

  //Update the record
  updateRecordByID('orders', record.id, updateOrder)

}

//***************************************************************************
//******************* INVOICE FORMS *****************************************
//***************************************************************************

//******************* RECORD CREATED ****************************************

//Add Invoice
//https://lovelight.knack.com/tracker#jobs/view-job-details/{}/add-invoice/{}/
//https://builder.knack.com/lovelight/tracker#pages/scene_68/views/view_127
$(document).on('knack-record-create.view_127', function(event, view, record) {
  processNewInvoiceRecord(record);
});

//Add Invoice - manage invoices
//
$(document).on('knack-record-create.view_163', function(event, view, record) {
  processNewInvoiceRecord(record);
});

//Issue Invoice
$(document).on('knack-form-submit.view_1751', function(event, view, record) {
  issueInvoice(record);
})

//***************************************************************************
//******************* PROCESS NEW INVOICE ***********************************
//***************************************************************************

function processNewInvoiceRecord(record) {

  var jobID = record.field_155_raw['0'].id;
  var percentageDue = record.field_1403;

  console.log(percentageDue);

  var data = {};

  //Get the details of the invoice's job
  var getJob = fetch('https://api.knack.com/v1/objects/object_3/records/' + jobID, {
      method: 'GET',
      headers: myKnackHeaders
    })
    .then(function(res) {
      return res.json();
    })
    .then(function(job) {

      //If there is a company we'll use the company name, otherwise the contact name
      if (job.field_1459.length > 0) {
        data.field_1398 = job.field_1459_raw['0'].identifier; //This needs to be updated when we migrate companies data
      } else {
        data.field_1398 = job.field_80_raw['0'].identifier;
      }

      if (percentageDue != 'Other') {
        data.field_154 = parseInt(job.field_130_raw.replace(/\,/g, '')) * parseInt(percentageDue.replace(/\%/g, '')) / 100;
        console.log(job.field_130_raw.replace(/\,/g, ''))
        console.log(parseInt(job.field_130_raw.replace(/\,/g, '')))

        console.log(data.field_154);
      }
    })
    .then(function() {

      console.log(data);

      //write details back to the invoice
      updateRecordByID('invoices', record.id, data)

    })

}


//***************************************************************************
//******************* ISSUE INVOICE ****************************************
//***************************************************************************

function issueInvoice(record) {

  //Invoice Variables
  var invoiceID = record.id;
  var invoiceAccount = record.field_1398;
  var invoiceContactID = record.field_1396_raw["0"].id;
  var invoiceValueFormatted = record.field_154;
  var invoiceValue = parseInt(record.field_154_raw.replace(/\,/g, ''));
  var invoicePercent = record.field_156;
  var invoiceType = record.field_313;
  var dueDateOption = record.field_1399;
  var invoiceDueDate; //= record.field_835 > 0 ? record.field_835_raw.date_formatted : undefined;
  var invoiceDueDateUTC;
  var invoiceService = record.field_314 == 'Other' ? record.field_315 : record.field_314;
  var invoicePO = record.field_319.length > 0 ? 'PO Number: ' + record.field_319 : undefined;
  var xeroAccount = "";
  var xeroAccountNumber = "";
  var description = "";

  //Job Varialbes
  var jobRecord;
  var jobID = record.field_155_raw['0'].id;
  var jobSite = "";
  var jobState = "";
  var jobValue = 0;
  var jobValueFormatted = "";
  var jobValueInvoiced = 0;
  var jobValueRemaining = "";
  var jobName = record.field_155_raw['0'].identifier;
  var jobSalesID = "";

  //Salesperson Variables
  var salespersonRecord;
  var salesPersonEmail = ""

  //Flag on printing to console or not
  var debug = true;

  //Required to look up accounts based on job details
  var xeroAccounts = [{
      id: 0,
      account: 'VIC - Custom',
      number: 41000
    },
    {
      id: 1,
      account: 'VIC - Apartments',
      number: 41002
    },
    {
      id: 2,
      account: 'VIC - Projects',
      number: 41600
    },
    {
      id: 3,
      account: 'VIC - Displays',
      number: 41031
    },
    {
      id: 4,
      account: 'VIC - FF&E',
      number: 41606
    },
    {
      id: 5,
      account: 'VIC - Volume',
      number: 41030
    },
    {
      id: 6,
      account: 'NSW - Custom',
      number: 41006
    },
    {
      id: 7,
      account: 'NSW - Apartments',
      number: 41007
    },
    {
      id: 8,
      account: 'NSW - Projects',
      number: 41602
    },
    {
      id: 9,
      account: 'NSW - Displays',
      number: 41035
    },
    {
      id: 10,
      account: 'NSW - Volume',
      number: 41034
    },
    {
      id: 11,
      account: 'QLD - Custom',
      number: 41003
    },
    {
      id: 12,
      account: 'QLD - Apartments',
      number: 41004
    },
    {
      id: 13,
      account: 'QLD - Projects',
      number: 41601
    },
    {
      id: 14,
      account: 'QLD - Displays',
      number: 41033
    },
    {
      id: 15,
      account: 'QLD - Volume',
      number: 41032
    },
    {
      id: 16,
      account: 'SA - Custom',
      number: 41039
    },
    {
      id: 17,
      account: 'SA - Apartments',
      number: 41008
    },
    {
      id: 18,
      account: 'SA - Projects',
      number: 41603
    },
    {
      id: 19,
      account: 'SA - Displays',
      number: 41038
    },
    {
      id: 20,
      account: 'SA - Volume',
      number: 41036
    }
  ];

  //Set the invoice due date
  if (record.field_1399.indexOf('Immediately') >= 0) {
    invoiceDueDate = moment().format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().format();
  } else if (record.field_1399.indexOf('7 days') >= 0) {
    invoiceDueDate = moment().add(7, 'days').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(7, 'days').format();
  } else if (record.field_1399.indexOf('14 days') >= 0) {
    invoiceDueDate = moment().add(14, 'days').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(14, 'days').format();
  } else if (record.field_1399.indexOf('30 days') >= 0) {
    invoiceDueDate = moment().add(30, 'days').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(30, 'days').format();
  } else if (record.field_1399.indexOf('End of next month') >= 0) {
    invoiceDueDate = moment().add(1, 'months').endOf('month').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(1, 'months').endOf('month').format();
  } else if (record.field_1399.indexOf('Pick a date') >= 0) {
    invoiceDueDate = record.field_835_raw.date_formatted;
    invoiceDueDateUTC = moment(invoiceDueDate, "DD/MM/YYYY").format();
  } else { //date is missing, defulat to today
    invoiceDueDate = moment().format("DD/MM/YYYY")
    invoiceDueDateUTC = moment().format();
  }

  //Create formatter for reformatting currency after calculation
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  })

  var getJob = getRecord('job', jobID)
    .then(function(res) {
      return res.json();
    })
    .then(function(job) {

      jobSite = job.field_12.replace(/<\/?[^>]+(>|$)/g, " ");
      jobValue = parseInt(job.field_130_raw.replace(/\,/g, ''));
      jobValueFormatted = job.field_130;
      jobValueInvoiced = parseInt(job.field_162.replace(/\,/g, '').replace(/\$/g, ''));
      jobValueRemaining = formatter.format(jobValue - jobValueInvoiced);

      jobRecord = job;
      jobState = job.field_58;
      jobSalesID = job.field_1276_raw["0"].id;
      xeroAccount = jobState + ' - ' + job.field_59;
      xeroAccountNumber = xeroAccounts.find(xeroAccountNumber => xeroAccountNumber.account == xeroAccount).number;
      description = "";

      //Build invoice description
      if (jobSite.length > 0) { //Don't include job site if this is blank
        description = "Site address: " + jobSite + '\n\n';
      }
      //Add the service being provided
      description += invoiceService + '\n\n';

      //Add the job value
      if (invoiceType != 'Call Out Fee') {
        description += 'Total Job Value: ' + jobValueFormatted + ' excluding GST.\n' + invoicePercent + ' ' + invoiceType + ' due.\n'
      }

      //Add variable detail
      if (invoiceType == 'Balance') {
        description += 'Payment due before installation.';
      } else if (invoiceType == 'Deposit') {
        description += 'Payment due to commence works.';
      } else if (invoiceType == 'Installment') {
        description += 'Total remaining to be invoiced is ' + jobValueRemaining;
      } else if (invoiceType == 'Call Out Fee') {
        description += 'Payment due prior to service call'
      }

      //Add PO number if present
      if (invoicePO !== undefined) {
        description += '\n\n' + invoicePO;
      }

    })
    .catch(function(error) {
      console.log('Request failed', error)
    })

  var getSales = getJob.then(function() {

      return getRecord('salesperson', jobSalesID);
    })
    .then(function(res) {
      return res.json();
    })
    .then(function(salesperson) {
      salespersonRecord = salesperson;
      salesPersonEmail = salesperson.field_957_raw.email;
    })
    .then(function() {

      console.log('ready to create invoice!');

      var data = {};

      data.invoiceID = invoiceID;
      data.invoiceContactID = invoiceContactID;
      data.invoiceContactName = invoiceAccount;
      data.dueDate = invoiceDueDate;
      data.dueDateFormatted = invoiceDueDateUTC;
      data.reference = jobName;
      data.description = description;
      data.invoiceValue = invoiceValue;
      data.accountCode = xeroAccountNumber;
      data.state = jobState;
      data.salesPerson = salesPersonEmail;

      return sendHookToZapier('cmjwd2', data, 'Create Invoice');

    })
    .then(function() {

      if (debug) {

        console.log(jobRecord);
        console.log(salespersonRecord);
        console.log('Job ID: ' + jobID);
        console.log('Job Name: ' + jobName);
        console.log('Invoice Account: ' + invoiceAccount);
        console.log('Invoice Contact ID: ' + invoiceContactID);
        console.log('FOrmatted Invoice Value: ' + invoiceValueFormatted);
        console.log('Raw Invoice Value: ' + invoiceValue);
        console.log('Invoice Percent: ' + invoicePercent);
        console.log('Invoice Type: ' + invoiceType);
        console.log('Due Date Option: ' + dueDateOption);
        console.log('Original Due Date: ' + invoiceDueDate);
        console.log('Adjusted Due Date: ' + invoiceDueDate);
        console.log('Service Provided: ' + invoiceService);
        console.log('PO Number: ' + invoicePO);
        console.log('Job Site: ' + jobSite);
        console.log('Job Value: ' + jobValue);
        console.log('Job Value Formatted: ' + jobValueFormatted);
        console.log('Total Invoiced Value: ' + jobValueInvoiced);
        console.log('Value Yet To Be Invoiced: ' + jobValueRemaining);
        console.log('Xero Account: ' + xeroAccount);
        console.log('Xero Account Number: ' + xeroAccountNumber);
        console.log('Description: ' + description);
        console.log('Sales email: ' + salesPersonEmail);
      }

    })
    .catch(function(error) {
      console.log('Request failed', error)
    })

}

//***************************************************************************
//******************* REMOVE HEADER ON SCHEDULING CALENDAR ******************
//***************************************************************************

// view 1347 update to hide calendar header.
$(document).on('knack-records-render.view_1347', function(event, view, records) {

  //function removeHeader() {
  //  $('div.fc-event-head').hide();
  // }

  //setTimeout(removeHeader, 1000);
});

//***************************************************************************
//******************* INSTALLERS ******************
//***************************************************************************
$(document).on('knack-scene-render.scene_642', function(event, scene) {

    $('#view_2072, #view_2071').detach().prependTo('#view_2062 .control') // Move no issues button into menu
    $('#view_1442').css({"clear":"both","margin-top":"2em"}) // Details view below buttons
    $('#view_2071, #view_2072').css({"float":"left","margin-right":"0.6em","margin-bottom":"5px"}) // Format button in menu

});

$(document).on('knack-scene-render.scene_509', function(event, scene) {

//  const target = document.getElementById('view_2057');
//  const options = {
//    attributes: true,
//    attributeOldValue: true,
//  };
//  const observer = new MutationObserver(callback);

//  function callback (mutations) {

//   mutations.forEach((mutation) => {
//		console.log(mutation)
//    })
//  }

//  observer.observe(target, options);
debugger
  waitForAddedNode({
    id: 'view_2057',
    parent: document.querySelector('.container'),
    recursive: false,
    done: function(el) {
        console.log(el);
    }
});

});

function waitForAddedNode(params) {
    new MutationObserver(function(mutations) {
        var el = document.getElementById(params.id);
        if (el) {
            this.disconnect();
            params.done(el);
        }
    }).observe(params.parent || document, {
        subtree: !!params.recursive,
        childList: true,
    });
}

// Installer Report within call out
$(document).on('knack-view-render.view_2074', function(event, view) {
  $('#view_2074-field_1542').on('change',function() {
  	let outcome = $('#view_2074-field_1542').val()
    if (outcome.includes("Issues")) {
      document.getElementById('field_1545').value = "Call out completed without issues"
    } else {
      document.getElementById('field_1545').value = ""
    }
  })
})

// Installer Report from reporting page
$(document).on('knack-view-render.view_2077', function(event, view) {
  $('#view_2077-field_1542').on('change',function() {
  	let outcome = $('#view_2077-field_1542').val()
    if (outcome.includes("Issues")) {
      document.getElementById('field_1545').value = "Call out completed without issues"
    } else {
      document.getElementById('field_1545').value = ""
    }
  })
})
