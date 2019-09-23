//***************************************************************************
//******************* INVOICE FORMS *****************************************
//***************************************************************************

//******************* RECORD CREATED ****************************************

//Add Invoice
//https://lovelight.knack.com/tracker#jobs/view-job-details/{}/add-invoice/{}/
//https://builder.knack.com/lovelight/tracker#pages/scene_68/views/view_127
$(document).on('knack-record-create.view_127 knack-record-create.view_2342', function(event, view, record) {
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

async function issueInvoice(record) {

  //Invoice Variables
  let invoiceID = record.id;
  let invoiceAccount = record.field_1398;
  let invoiceContactID = record.field_1396_raw["0"].id;
  let invoiceValueFormatted = record.field_154;
  let invoiceValue = parseInt(record.field_154_raw.replace(/\,/g, ''));
  let invoicePercent = record.field_156;
  let invoiceType = record.field_313;
  let dueDateOption = record.field_1399;
  let invoiceDueDate; //= record.field_835 > 0 ? record.field_835_raw.date_formatted : undefined;
  let invoiceDueDateUTC;
  let invoiceService = record.field_314 == 'Other' ? record.field_315 : record.field_314;
  let invoicePO = record.field_319.length > 0 ? 'PO Number: ' + record.field_319 : undefined;
  let xeroAccount = "";
  let xeroAccountNumber = "";
  let description = "";

  //Job Varialbes
  let jobRecord;
  let jobID = record.field_155_raw['0'].id;
  let jobSite = "";
  let jobState = "";
  let jobValue = 0;
  let jobValueFormatted = "";
  let jobValueInvoiced = 0;
  let jobValueRemaining = "";
  let jobName = record.field_155_raw['0'].identifier;
  let jobSalesID = "";

  //Salesperson Variables
  let salespersonRecord;
  let salesPersonEmail = ""

  //Required to look up accounts based on job details
  const xeroAccounts = [{
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

  let job = await getRecordPromise('object_3', jobID)

  jobSite = job.field_12.replace(/<\/?[^>]+(>|$)/g, " ");
  jobValue = job.field_130_raw ? parseInt(job.field_130_raw.replace(/\,/g, '')) : 0
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
    description += 'Payment due upon receipt'
  }

  //Add PO number if present
  if (invoicePO !== undefined) {
    description += '\n\n' + invoicePO;
  }

  let salesperson = await getRecordPromise('object_82', jobSalesID)

  salespersonRecord = salesperson;
  salesPersonEmail = salesperson.field_957_raw.email;

  let data = {};

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

}


async function createCallOutInvoice(record) {
  // Insert a connected invoice
  let data = {
    field_155: [record.field_928_raw[0].id], // Job
    field_1629: [record.id], // Link to this callout
    field_1396: [record.field_1025_raw[0].id], // Invoice Contact to Site Contact
    field_1398: record.field_1025_raw[0].identifier, // Issue Invoice To to Site Contact Name
    field_313: 'Call Out Fee', // Invoice type
    field_315: 'Service Call', // Custom Service
    field_314: 'Other', // Sevice Option
    field_835: moment().format("DD/MM/YYYY"), // Due date
    field_1399: 'Pick a date'
  }
  let invoiceObj = new KnackObject(objects.invoices)
  let invoice = await invoiceObj.create(data)
  return invoice
}
