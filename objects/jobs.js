const jobCreatedEvents = [
  'knack-record-create.view_33', // #dashboard/jobs2/add-job/, #pages/scene_18/views/view_33
  'knack-record-create.view_609', // Job Details > Add Related Job, #jobs/view-job-details, #pages/scene_244/views/view_609
  'knack-record-create.view_1671', // #custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity2, #pages/scene_776/views/view_1671
  'knack-record-create.view_1670' // #custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity, #pages/scene_776/views/view_1670
]
const jobUpdatedEvents = [
  'knack-cell-update.view_1065', // Issue jobs, install-issues/, #pages/scene_453/views/view_1065
  'knack-form-submit.view_1067', // What went wrong commercial #install-issues/what-went-wrong/{}/, #pages/scene_474/views/view_1067
  'knack-cell-update.view_1325', // QLD Incoice reconcilliation #invoice-reconciliation, #pages/scene_593/views/view_1325
  'knack-cell-update.view_1642', // Ops Recently Completed #my-jobs3, #pages/scene_713/views/view_1642
  'knack-cell-update.view_673', //  Jobs #jobs, #pages/scene_17/views/view_673
  'knack-form-submit.view_1249', // Job Details > Change status commercial #jobs/view-job-details/{}/, #pages/scene_52/views/view_1249
  'knack-form-submit.view_234', //  Job Details > Change status custom #jobs/view-job-details/{}/, #pages/scene_52/views/view_234
  'knack-form-submit.view_1151', // Job Details > Change status custom > Enter Planned Install Date, #jobs/view-job-details/{}/, #pages/scene_515/views/view_1151
  'knack-form-submit.view_1157', // Job Details > Change status custom > Enter Measure Date,  #jobs/view-job-details/{}/, #pages/scene_520/views/view_1157
  'knack-form-submit.view_1158', // Job Details > Change status custom > Enter Actual Install Date, #jobs/view-job-details/{}/, #pages/scene_521/views/view_1158
  'knack-form-submit.view_1160', // Job Details > Change status custom > Enter Job Completed Details, #jobs/view-job-details/{}/, #pages/scene_522/views/view_1160
  'knack-form-submit.view_1161', // Job Details > Change status custom > Confirm Measure Request, #jobs/view-job-details/{}/, #pages/scene_523/views/view_1161
  'knack-form-submit.view_1165', // Job Details > Change status custom > Confirm Install Request, #jobs/view-job-details/{}/, #pages/scene_525/views/view_1165
  'knack-cell-update.view_1153', // Job Details > Edit Job Dates, #jobs/view-job-details/{}/edit-job-dates/{}/s, #pages/scene_517/views/view_1153
  'knack-cell-update.view_1288', // Job Details > Edit Team, #jobs/view-job-details/{}/edit-job-team/{}/s, #pages/scene_571/views/view_1288
  'knack-cell-update.view_1551', // Job Details > Edit Outcome, #jobs/view-job-details/{}/edit-outcome/{}/s, #pages/scene_698/views/view_1551
  'knack-form-submit.view_1228', // Job Details > Edit Job - Project Managers, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1228
  'knack-form-submit.view_1227', // Job Details > Edit Job - Issues, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1227
  'knack-form-submit.view_395', //  Job Details > Edit Job -Customer Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_395
  'knack-form-submit.view_1222', // Job Details > Edit Job - Site Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1222
  'knack-form-submit.view_1225', // Job Details > Edit Job - Invoice Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1225
  'knack-form-submit.view_1224', // Job Details > Edit Job - General Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1224
  'knack-form-submit.view_1043', // Job Details > Request Feedback, #jobs/view-job-details/{}/request-feedback/{}/, #pages/scene_177/views/view_1043
  'knack-form-submit.view_1051', // Job Details > Request Product Review, #jobs/view-job-details/{}/request-product-review/{}/, #pages/scene_177/views/view_1051
  'knack-form-submit.view_1053', // Job Details > Request Feedback, #jobs/view-job-details/{}/request-google-revi ew/{}/, #pages/scene_177/views/view_1053
]

// Job record created
$(document).on(jobCreatedEvents.join(' '), function(event, view, record) {
  addJobToJobRec(record)
  processJobChanges(record)
});

// Job updated
$(document).on(jobUpdatedEvents.join(' '), function(event, view, record) {
  processJobChanges(record)
});

//******************** CREATE JOB IN JOBREC ********************************

async function processJobChanges(record) {

  const trackStatusChange = [
    ['field_245', 'field_254'], // status
  ]

  const stateTransitionDetails = [
    //Job status id, portal status name, callout type name, portal date field to update
    ['58dc50e744a6e73c9eeea627', 'measure_booked', 'Measure'],
    ['58dc514144a6e73c9eeea664', 'install_booked', 'Install']
  ]

  let linkedCallOutFilter = function(jobId, callOutType) {
    return {
      "match": "and",
      "rules": [{
        "field": "field_928",
        "operator": "contains",
        "value": jobId,
        "field_name": "Jobs"
      }, {
        "match": "and",
        "field": "field_925",
        "operator": "is",
        "value": callOutType,
        "field_name": "Call Out Type Options"
      }, {
        "match": "and",
        "field": "field_955",
        "operator": "is",
        "value": "No",
        "field_name": "Tentative"
      }]
    }
  }

  let isStatusUpdated = isObjectUpdated(record, trackStatusChange)
  let measureOrInstallDetails = stateTransitionDetails.filter((transition) => transition[0] === record.field_245_raw[0].id)[0]
  // Is the status measure or install booked? Is it a commercial job? Is there a development ?
  let isPortalUpdateRequired = measureOrInstallDetails !== undefined && record.field_59.indexOf('Apartments') > -1 && record.field_186.length > 0

  if (isStatusUpdated) {
    // Get data to update previous status tracking fields
    let data = copyFieldsToNewObject(record, trackStatusChange)
    // Status change date
    data.field_260 = moment().format("DD/MM/YYYY hh:mma")
    // Update the job
    updateRecordPromise('object_3', record.id, data)
    // TBD - insert a record into history

    if (isPortalUpdateRequired) {
      let latestCallOuts = await searchRecordsPromise('object_78', linkedCallOutFilter(record.id, measureOrInstallDetails[2]))
      let jobId = record.id
      let changeStateTo = measureOrInstallDetails[1]
      let measure_booked_date = measureOrInstallDetails[2] === 'Measure' && latestCallOuts.length > 0 ? latestCallOuts[0].field_939 : '' //This is group by date, don't need time,
      let date_of_install = measureOrInstallDetails[2] === 'Install' && latestCallOuts.length > 0 ? latestCallOuts[0].field_939 : ''
      changeStatusInPortal(jobId, changeStateTo, measure_booked_date, date_of_install)
    }
  }
}

// Send required data to Zapier to update portal
function changeStatusInPortal(jobId, targetStatus, measureDate, installDate) {
  let data = {
    'jobId': jobId,
    'changeStateTo': targetStatus,
    'measure_booked_date': measureDate,
    'date_of_install': installDate
  }
  triggerZap('vdv8sq', data, 'Portal state changed')
  Swal.fire({
    position: 'top-end',
    type: 'success',
    title: '<span style="font-size:16px;">Portal status updated</span>',
    showConfirmButton: false,
    showCloseButton: true,
    timer: 2000,
    backdrop: false,
    width: 300,
    padding: 10,
    background: '#e5ffe5'
  })
}

function addJobToJobRec(job) {
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
