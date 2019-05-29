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
  }, {
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

  if (Knack.getUserAttributes() != 'No user found' && !(userRoles.length == 1 && userRoles[0] == 'object_71')) { // not logged in or an installer

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

const hideEmptyTablePages = [
  'knack-scene-render.scene_703', //My Jobs https://lovelight.knack.com/tracker#my-jobs/
  'knack-scene-render.scene_720', //My Invoices https://lovelight.knack.com/tracker#my-invoices/
  'knack-scene-render.scene_417', //My To Quote dashboard ??
  'knack-scene-render.scene_707', // My Opportunities https://lovelight.knack.com/tracker#my-opportunities/
  'knack-scene-render.scene_1578', // My Jobs ??
  'knack-scene-render.scene_778', // My Jobs https://lovelight.knack.com/tracker#my-scheduling-jobs/my-jobs2/
  'knack-scene-render.scene_956', // My Remakes https://lovelight.knack.com/tracker#my-remakes/
  'knack-scene-render.scene_959', // Track Remakes https://lovelight.knack.com/tracker#my-remakes/track-remake/{}/
  'knack-scene-render.scene_52', // View Job Details
]
//******************** VIEW JOB DETAILS ********************************
$(document).on(hideEmptyTablePages.join(' '), function(event, scene) {
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
        })).catch(logError(hopeItDoesntBreak, arguments, err, Knack.getUserAttributes(), window.location.href, true)) // This needs work
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
//******************* UPDATE OPPORTUNITIES ********************
//***************************************************************************

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
  zapierData.value_formatted = record.field_128_raw.split(".")[0];
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
      updateRecordPromise('object_19', record.id, data)

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

  var getJob = getRecordPromise('object_3', jobID)
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

      return getRecordPromise('object_82', jobSalesID);
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

      return triggerZap('cmjwd2', data, 'Create Invoice');

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
  $('#view_1442').css({
    "clear": "both",
    "margin-top": "2em"
  }) // Details view below buttons
  $('#view_2071, #view_2072').css({
    "float": "left",
    "margin-right": "0.6em",
    "margin-bottom": "5px"
  }) // Format button in menu

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
  $('#view_2074-field_1542').on('change', function() {
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
  $('#view_2077-field_1542').on('change', function() {
    let outcome = $('#view_2077-field_1542').val()
    if (outcome.includes("Issues")) {
      document.getElementById('field_1545').value = "Call out completed without issues"
    } else {
      document.getElementById('field_1545').value = ""
    }
  })
})
