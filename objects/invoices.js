$(document).on('knack-form-submit.view_1751', function(event,view, record){
  handleSendingInvoices(record)
})

async function processNewInvoice({
  record: invoice
}) {

  try {

    let jobId = invoice.field_155_raw[0].id;
    let percentageDue = invoice.field_1403;

    let data = {};

    let jobObj = new KnackObject(objects.jobs)
    let job = await jobObj.get(jobId)

    //If there is a company we'll use the company name, otherwise the contact name
    if (job.field_1459.length > 0) {
      data.field_1398 = job.field_1459_raw['0'].identifier;
    } else {
      data.field_1398 = job.field_80_raw['0'].identifier;
    }

    // Get amount due if percentage is custom value
    if (percentageDue != 'Other') {
      let value = parseFloat(job.field_130_raw.replace(/\,/g, ''))
      let percent = parseFloat(percentageDue.replace(/\%/g, '')) / 100
      let due = value * percent
      data.field_154 = (due).toFixed(2);
    }

    // Consolidate the data
    let updateData = Object.assign({}, data)

    // Update the job
    if (!$.isEmptyObject(updateData)) {
      let invoiceObj = new KnackObject(objects.invoices)
      invoice = await invoiceObj.update(invoice.id, updateData)
    }

  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}

async function handleSendingInvoices(invoice) {
  try {

    let dueDate = getInvoiceDueDate(invoice)
    let description = await getInvoiceDescription(invoice)
    let xeroAccount = getXeroAccountNumber(invoice.field_434, invoice.field_698)

    let salesId
    if(invoice.field_1280_raw){
      salesId = invoice.field_1280_raw[0].id
    } else {
      let jobId = invoice.field_155_raw[0].id;
      let jobObj = new KnackObject(objects.jobs)
      let job = await jobObj.get(jobId)
      salesId = job.field_1276_raw[0].id
    }

    let salesObj = new KnackObject(objects.salespeople)
    let salesperson = await salesObj.get(salesId)

    let data = {};

    data.invoiceID = invoice.id;
    data.invoiceContactID = invoice.field_1396_raw[0].id;
    data.invoiceContactName = invoice.field_1398;
    data.dueDate = dueDate.date;
    data.dueDateFormatted = dueDate.utc;
    data.reference = invoice.field_155_raw[0].identifier;
    data.description = description;
    data.invoiceValue = parseFloat(invoice.field_154_raw.replace(/\,/g, '')).toFixed(2);
    data.accountCode = xeroAccount;
    data.state = invoice.field_434;
    data.salesPerson = salesperson.field_957_raw.email;

    return triggerZap('cmjwd2', data, 'Create Invoice');

  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}

function getInvoiceDueDate(invoice) {

  let dueDate = {}
  dueDate.date = moment().format("DD/MM/YYYY")
  dueDate.utc = moment().format()

  let dueDateOption = invoice.field_1399

  if (dueDateOption.indexOf('Pick a date') >= 0) {
    dueDate.date = invoice.field_835_raw.date_formatted;
    dueDate.utc = moment(dueDate.date, "DD/MM/YYYY").format();
  }

  if (hasNumber(dueDateOption)) {
    let days = dueDateOption.match(/\d/)[0]
    dueDate.date = moment().add(days, 'days').format("DD/MM/YYYY");
    dueDate.utc = moment().add(days, 'days').format();
  }

  if (dueDateOption.indexOf('End of next month') >= 0) {
    dueDate.date = moment().add(1, 'months').endOf('month').format("DD/MM/YYYY");
    dueDate.utc = moment().add(1, 'months').endOf('month').format();
  }

  return dueDate

}

async function getInvoiceDescription(invoice) {

  try {
    let description = ''

    let jobId = invoice.field_155_raw[0].id;
    let jobObj = new KnackObject(objects.jobs)
    let job = await jobObj.get(jobId)

    //Invoice Variables
    let invoicePercent = invoice.field_156;
    let invoiceType = invoice.field_313;
    let invoiceService = invoice.field_314 == 'Other' ? invoice.field_315 : invoice.field_314;

    //Job Varialbes
    let jobSite = job.field_12.replace(/<\/?[^>]+(>|$)/g, " ");
    let jobValue = job.field_130_raw ? parseFloat(job.field_130_raw.replace(/\,/g, '')).toFixed(2) : 0
    let jobValueFormatted = job.field_130;
    let jobValueInvoiced = parseFloat(job.field_162.replace(/\,/g, '').replace(/\$/g, '')).toFixed(2);
    let jobValueRemaining = formatAsDollars(jobValue - jobValueInvoiced);

    //Build invoice description
    if (jobSite.length > 0) description = "Site address: " + jobSite + '\n\n'

    //Add the service being provided
    description += invoiceService + '\n\n';

    //Add the job value
    if (invoiceType != 'Call Out Fee') description += 'Total Job Value: ' + jobValueFormatted + ' excluding GST.\n' + invoicePercent + ' ' + invoiceType + ' due.\n'

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

    return description

  } catch (err){
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}

function getXeroAccountNumber(state, division) {

  //Required to look up accounts based on job details
  const XERO_ACCOUNTS = [{
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

  let accountName = state + ' - ' + division
  let accountNumber = XERO_ACCOUNTS.find(xeroAccountNumber => xeroAccountNumber.account == accountName).number;
  return accountNumber
}

async function createCallOutInvoice(record) {
  try {
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
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }
}
