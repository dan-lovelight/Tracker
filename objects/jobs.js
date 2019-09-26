// Process newly created jobs
async function processNewJob({
  record: job,
  view,
  previous,
  changes
}) {
  try {

    // Get name of user creating the job
    let user = Knack.getUserAttributes()
    let data = {}
    data.field_1656 = user.name // created by
    data.field_260 = moment().format("DD/MM/YYYY hh:mma") // Status change date
    data.field_1652 = '' // Remove notes, these have been copied to an activity record

    // Collect any other update data to be processed for a newely created job
    // ....

    // Consolidate the data
    let updateData = Object.assign({}, data)

    // Update the job
    let jobsObj = new KnackObject(objects.jobs)
    await jobsObj.update(job.id, updateData)

    // Downstream updates - currently updates above are not passed downstream
    handleJobNotes(job, true, view, previous, changes)
    copyCatAndQuoteToDocs(job)
    addJobToJobRec(job)

  } catch (err) {
    Sentry.captureException(err)
  } finally {}
}

async function processUpdatedJob({
  record: job,
  changes,
  view,
  previous
}) {
  try {
    // Get data to update the job
    let statusUpdates = getStatusChangeDetails(changes)
    let data = {}
    data.field_1652 = '' // Remove notes, these have been copied to an activity record

    // Consolidate the data
    let updateData = Object.assign({}, statusUpdates)

    // Update the job
    if (!$.isEmptyObject(updateData)) {
      let jobsObj = new KnackObject(objects.jobs)
      job = await jobsObj.update(job.id, updateData)
    }

    // Downstream changes
    handleJobNotes(job, false, view, previous, changes)
    handlePortalUpdates(job, changes)

  } catch (err) {
    Sentry.captureException(err)
  }
}

async function handlePortalUpdates(job, changes) {

  if (isPortalUpdateRequired(job, changes)) {

    let jobStatusIds = {
      'measureBooked': '58dc50e744a6e73c9eeea627',
      'installBooked': '58dc514144a6e73c9eeea664'
    }

    let jobStatusId
    let portalData = {}
    portalData.jobId = job.id

    if (isStatusMeasureBooked(job)) {
      jobStatusId = jobStatusIds.measureBooked
      portalData.newPortalState = 'measure_booked'
    } else {
      jobStatusId = jobStatusIds.installBooked
      portalData.newPortalState = 'install_booked'
    }

    let calloutFilter = {
      "match": "and",
      "rules": [{
        "field": "field_928",
        "operator": "contains",
        "value": job.id,
        "field_name": "Jobs"
      }, {
        "match": "and",
        "field": "field_925",
        "operator": "is",
        "value": jobStatusId,
        "field_name": "Call Out Type Options"
      }, {
        "match": "and",
        "field": "field_955",
        "operator": "is",
        "value": "No",
        "field_name": "Tentative"
      }]
    }

    let calloutObj = new KnackObject(objects.callouts)
    let latestCallOuts = await calloutObj.find(calloutFilter)

    // Get date of the install or measure
    portalData.date = ''
    if (latestCallOuts.length > 0) portalData.date = latestCallOuts[0].field_939

    changeStatusInPortal(portalData)
  }

  // Send required data to Zapier to update portal
  function changeStatusInPortal({
    jobId,
    newPortalState,
    date
  }) {
    let data = {
      'jobId': jobId,
      'changeStateTo': newPortalState,
      'measure_booked_date': date,
      'date_of_install': date
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

}

function getStatusChangeDetails(changes) {
  let data = {}
  if (isJobStatusUpdated(changes)) {
    data.field_260 = moment().format("DD/MM/YYYY hh:mma") // Status change date
  }
  return data
}

function handleJobNotes(job, isNewJob, view, previous, changes) {
  try {
    let user = Knack.getUserAttributes()
    let isThereANote = isNoteAdded(job)
    let isStatusUpdated = isJobStatusUpdated(changes)
    let isValueUpdated = isJobValueUpdated(changes)
    let notes = []
    let data = {}

    data.field_1655 = user.name // Create by
    data.field_579 = [job.id]

    if (isNewJob) {
      // Insert job created record
      data.field_1659 = ['5d8c093bfc02f50011364c1e'] // Job Created
      data.field_887 = 'Job Created' // Delete this field once migration is complete
      data.field_576 = `Job created from ${view.name} form`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isThereANote) {
      // Insert a note record
      data.field_1659 = ['5d8c078bdb00f0001095e39d'] // Note
      data.field_887 = 'Note' // Delete this field once migration is complete
      data.field_576 = job.field_1652 // Note details
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isStatusUpdated) {
      // Insert a status change record
      data.field_1659 = ['5d8c0d5622d07d0010b41b9e'] // Status Change
      data.field_887 = 'Status Changed' // Delete this field once migration is complete
      data.field_576 = `Status changed from ${previous.field_245_raw[0].identifier.split(' - ')[1]} to ${job.field_245_raw[0].identifier.split(' - ')[1]}`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isValueUpdated) {
      // Insert a value change record
      data.field_1659 = ['5d8c0e42ca31bf0010deb365'] // Value Change
      data.field_887 = 'Value Changed' // Delete this field once migration is complete
      data.field_576 = `Job value changed from ${previous.field_130} to ${job.field_130}`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    // Insert the notes if there are any
    if (notes.length > 0) addJobActivityRecords(notes)
  } catch (err) {
    Sentry.captureException(err)
  }

}

// Accepts an array of record objects and attempts to create a job activty record for each
// Object should look like
// {
//  field_1655 : 'Created by name'
//  field_579 = ['jobId']
//  field_1659 = ['activityRecordType'] // Job Created
//  field_576 = 'Details of the change'
// }
async function addJobActivityRecords(records) {
  if (!isItAnArray(records) || records.length === 0) throw Error('Job Activities Records must be in an array')
  try { // Create the records
    let recordsObj = new KnackObject(objects.activityRecords)
    for (let i = 0; i < records.length; i++) {
      await recordsObj.create(records[i])
    }
  } catch (err) {
    Sentry.captureException(err)
  }
}

function isJobStatusUpdated(changes) {
  if (changes.includes('field_245')) return true
  return false
}

function isJobValueUpdated(changes) {
  if (changes.includes('field_130')) return true
  return false
}

function isNoteAdded(job) {
  if (job.field_1652.length > 0) return true
  return false
}

function isStatusMeasureBooked(job) {
  let statusId = job.field_245_raw[0].id
  let measureBookedId = '58dc50e744a6e73c9eeea627'
  if (statusId === measureBookedId) return true
  return false
}

function isStatusInstallBooked(job) {
  let statusId = job.field_245_raw[0].id
  let installBookedId = '58dc514144a6e73c9eeea664'
  if (statusId === installBookedId) return true
  return false
}

function isPortalUpdateRequired(job, changes) {
  let isNotCreatedByPortal = job.field_1635 === 'No'
  let isApartmentsJob = job.field_59.indexOf('Apartments') > -1
  let isDevelopmentPresent = job.field_186.length > 0

  if (isNotCreatedByPortal) return false
  if (!isApartmentsJob) return false // only need to update apartment jobs
  if (!isDevelopmentPresent) return false // if there's no development, it hasn't been created via the portal
  if (!isJobStatusUpdated(changes)) return false // no update required if there's been no change
  if (isStatusMeasureBooked(job) || isStatusInstallBooked(job)) return true // given status updated, true if measure or install booked
  return false
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

// Copy the CAT and Final quote directly added to the job to their own document records
async function copyCatAndQuoteToDocs(job) {
  let filesToMove = [{
    'sourceField': 'field_1589',
    'documentTypeId': '5d034328305b08000e687c54' // CAT
  }, {
    'sourceField': 'field_1590',
    'documentTypeId': '59065ebe64bb5e36417a406c' // Final Quote
  }]
  return await copyFilesFromJobToDocsRecord(job, filesToMove)
}

// Creates new document records for each of the files in the filesToMove array
// filesToMove = [{sourceField, documentTypeId}]
async function copyFilesFromJobToDocsRecord(job, filesToMove) {
  try {

    let docsObj = new KnackObject(objects.documents)

    let promises = filesToMove.map(file => {
      // Do nothing if there is no file
      if (job[file.sourceField + '_raw'] === undefined) {
        return
      }

      // Gather the file data
      let fileId = job[file.sourceField + '_raw'].id
      let data = {
        'field_207': [job.id], // Link document to the job
        'field_190': fileId, // link the actual file to the new record
        'field_301': [file.documentTypeId] // Select what type of ducment it is
      }

      // Create the file
      return docsObj.create(data)
    })

    // Wait for the new docs to be created
    return await Promise.all(promises)
  } catch {
    Sentry.captureException(err)
  }
}

//******************** PRE_FILL JOB CREATION FORMS FROM OPP DATA ***********

const newJobFromOppForms = [
  'knack-view-render.view_1670',
  'knack-view-render.view_1671',
]

const newJobFromScratchForms = [
  'knack-view-render.view_33',
]

// Job about to be created...
$(document).on(newJobFromOppForms.join(' '), function(event, view, data) {
  Knack.showSpinner()
  prefillJobsForm(view).then(updateJobRefPlaceholderText)
  Knack.hideSpinner()
});

// Job about to be created...
$(document).on(newJobFromScratchForms.join(' '), function(event, view, data) {
  updateJobRefPlaceholderText(view)
});

async function prefillJobsForm(view) {
  let opportunity = await getRecordPromise(view.scene.object, view.scene.scene_id)
  // Set the division

  $('#' + view.key + '-field_59')[0].value = opportunity.field_118
  $('#' + view.key + '-field_59').focus().blur() // remove focus to have page rules applied
  // Set job reference
  $('#field_5')[0].value = opportunity.field_116
  // Set the company contact
  if (opportunity.field_1460_raw && opportunity.field_1460_raw.length > 0) $('#' + view.key + '-field_1459').html(`<option value='${opportunity.field_1460_raw[0].id}'>${opportunity.field_1460_raw[0].identifier}</option>`).trigger('liszt:updated')
  // Set the client & site contacts
  if (opportunity.field_119_raw && opportunity.field_119_raw.length > 0) {
    $('#' + view.key + '-field_80').html(`<option value='${opportunity.field_119_raw[0].id}'>${opportunity.field_119_raw[0].identifier}</option>`).trigger('liszt:updated')
    $('#' + view.key + '-field_432').html(`<option value='${opportunity.field_119_raw[0].id}'>${opportunity.field_119_raw[0].identifier}</option>`).trigger('liszt:updated')
  }
  // Set job value
  $('#field_130')[0].value = opportunity.field_128_raw
  return view
}

function updateJobRefPlaceholderText(view) {
  // Apply on form load
  updatePlaceholder()
  // Apply when division is changed
  $('#' + view.key + '-field_59').on('change', function() {
    updatePlaceholder()
  })

  function updatePlaceholder() {
    let division = $('#' + view.key + '-field_59')[0]
    if (division) {
      division = division.value
      if (division === 'Custom') {
        $('#field_5')[0].placeholder = "Last Name and House Number eg 'LEWIS13'"
      } else if (division === 'Apartments') {
        $('#field_5')[0].placeholder = "Apartment Number eg 'G02'"
      } else if (division === 'Projects') {
        $('#field_5')[0].placeholder = "Project Name"
      } else {
        {
          $('#field_5')[0].placeholder = "Job Reference"
        }
      }
    }
  }
}


// const jobCreatedEvents = [
//   'knack-record-create.view_33', // #dashboard/jobs2/add-job/, #pages/scene_18/views/view_33
//   'knack-record-create.view_609', // Job Details > Add Related Job, #jobs/view-job-details, #pages/scene_244/views/view_609
//   'knack-record-create.view_1671', // #custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity2, #pages/scene_776/views/view_1671
//   'knack-record-create.view_1670' // #custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity, #pages/scene_776/views/view_1670
// ]
// const jobUpdatedEvents = [
//   'knack-cell-update.view_1065', // Issue jobs, install-issues/, #pages/scene_453/views/view_1065
//   'knack-form-submit.view_1067', // What went wrong commercial #install-issues/what-went-wrong/{}/, #pages/scene_474/views/view_1067
//   'knack-cell-update.view_1325', // QLD Incoice reconcilliation #invoice-reconciliation, #pages/scene_593/views/view_1325
//   'knack-cell-update.view_1642', // Ops Recently Completed #my-jobs3, #pages/scene_713/views/view_1642
//   'knack-cell-update.view_673', //  Jobs #jobs, #pages/scene_17/views/view_673
//   'knack-form-submit.view_1249', // Job Details > Change status commercial #jobs/view-job-details/{}/, #pages/scene_52/views/view_1249
//   'knack-form-submit.view_234', //  Job Details > Change status custom #jobs/view-job-details/{}/, #pages/scene_52/views/view_234
//   'knack-form-submit.view_1151', // Job Details > Change status custom > Enter Planned Install Date, #jobs/view-job-details/{}/, #pages/scene_515/views/view_1151
//   'knack-form-submit.view_1157', // Job Details > Change status custom > Enter Measure Date,  #jobs/view-job-details/{}/, #pages/scene_520/views/view_1157
//   'knack-form-submit.view_1158', // Job Details > Change status custom > Enter Actual Install Date, #jobs/view-job-details/{}/, #pages/scene_521/views/view_1158
//   'knack-form-submit.view_1160', // Job Details > Change status custom > Enter Job Completed Details, #jobs/view-job-details/{}/, #pages/scene_522/views/view_1160
//   'knack-form-submit.view_1161', // Job Details > Change status custom > Confirm Measure Request, #jobs/view-job-details/{}/, #pages/scene_523/views/view_1161
//   'knack-form-submit.view_1165', // Job Details > Change status custom > Confirm Install Request, #jobs/view-job-details/{}/, #pages/scene_525/views/view_1165
//   'knack-cell-update.view_1153', // Job Details > Edit Job Dates, #jobs/view-job-details/{}/edit-job-dates/{}/s, #pages/scene_517/views/view_1153
//   'knack-cell-update.view_1288', // Job Details > Edit Team, #jobs/view-job-details/{}/edit-job-team/{}/s, #pages/scene_571/views/view_1288
//   'knack-cell-update.view_1551', // Job Details > Edit Outcome, #jobs/view-job-details/{}/edit-outcome/{}/s, #pages/scene_698/views/view_1551
//   'knack-form-submit.view_1228', // Job Details > Edit Job - Project Managers, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1228
//   'knack-form-submit.view_1227', // Job Details > Edit Job - Issues, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1227
//   'knack-form-submit.view_395', //  Job Details > Edit Job -Customer Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_395
//   'knack-form-submit.view_1222', // Job Details > Edit Job - Site Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1222
//   'knack-form-submit.view_1225', // Job Details > Edit Job - Invoice Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1225
//   'knack-form-submit.view_1224', // Job Details > Edit Job - General Details, #jobs/view-job-details/{}/edit-job/{}/, #pages/scene_177/views/view_1224
//   'knack-form-submit.view_1043', // Job Details > Request Feedback, #jobs/view-job-details/{}/request-feedback/{}/, #pages/scene_177/views/view_1043
//   'knack-form-submit.view_1051', // Job Details > Request Product Review, #jobs/view-job-details/{}/request-product-review/{}/, #pages/scene_177/views/view_1051
//   'knack-form-submit.view_1053', // Job Details > Request Feedback, #jobs/view-job-details/{}/request-google-revi ew/{}/, #pages/scene_177/views/view_1053
// ]

// Job record created
// $(document).on(jobCreatedEvents.join(' '), function(event, view, record) {
//   addJobToJobRec(record)
//   processJobChanges(record)
// });

// async function processNewJob(record) {
//
//   try {
//     let filesToMoveToDocs = [{
//       'field': 'field_1589',
//       'description': '5d034328305b08000e687c54' // CAT
//     }, {
//       'field': 'field_1590',
//       'description': '59065ebe64bb5e36417a406c' // Final Quote
//     }]
//
//     let promises = filesToMoveToDocs.map(sourceField => {
//       // Do nothing if there is no file
//       if (record[sourceField.field + '_raw'] === undefined) {
//         return
//       }
//
//       // Gather the file data
//       let fileId = record[sourceField.field + '_raw'].id
//       let data = {
//         'field_207': [record.id],
//         'field_190': fileId,
//         'field_301': [sourceField.description]
//       }
//
//       // Create the file
//       return createRecordPromise('object_22', data)
//     })
//
//     // Wait for the new docs to be created
//     return newDocs = await Promise.all(promises)
//   } catch (err) {
//     logError(processNewJob, arguments, err, Knack.getUserAttributes(), window.location.href, true)
//   }
//
// }

// Job updated
// $(document).on(jobUpdatedEvents.join(' '), function(event, view, record) {
//   processJobChanges(record)
// });

//******************** CREATE JOB IN JOBREC ********************************

// async function processJobChanges(record) {
//
//   const trackStatusChange = [
//     ['field_245', 'field_254'], // status
//   ]
//
//   const stateTransitionDetails = [
//     //Job status id, portal status name, callout type name
//     ['58dc50e744a6e73c9eeea627', 'measure_booked', 'Measure'],
//     ['58dc514144a6e73c9eeea664', 'install_booked', 'Install']
//   ]
//
//   let linkedCallOutFilter = function(jobId, callOutType) {
//     return {
//       "match": "and",
//       "rules": [{
//         "field": "field_928",
//         "operator": "contains",
//         "value": jobId,
//         "field_name": "Jobs"
//       }, {
//         "match": "and",
//         "field": "field_925",
//         "operator": "is",
//         "value": callOutType,
//         "field_name": "Call Out Type Options"
//       }, {
//         "match": "and",
//         "field": "field_955",
//         "operator": "is",
//         "value": "No",
//         "field_name": "Tentative"
//       }]
//     }
//   }
//
//   let isStatusUpdated = isObjectUpdated(record, trackStatusChange)
//   let measureOrInstallDetails = stateTransitionDetails.filter((transition) => transition[0] === record.field_245_raw[0].id)[0]
//
//   // Is the status measure or install booked? Is it a commercial job? Is there a development ?
//   let isPortalUpdateRequired = measureOrInstallDetails !== undefined && record.field_59.indexOf('Apartments') > -1 && record.field_186.length > 0
//
//   if (isStatusUpdated) {
//     // Get data to update previous status tracking fields
//     let data = copyFieldsToNewObject(record, trackStatusChange)
//     // Status change date
//     data.field_260 = moment().format("DD/MM/YYYY hh:mma")
//     // Update the job
//     updateRecordPromise('object_3', record.id, data)
//     // TBD - insert a record into history
//
//     if (isPortalUpdateRequired) {
//       let latestCallOuts = await searchRecordsPromise('object_78', linkedCallOutFilter(record.id, measureOrInstallDetails[2]))
//       let jobId = record.id
//       let changeStateTo = measureOrInstallDetails[1]
//       let measure_booked_date = measureOrInstallDetails[2] === 'Measure' && latestCallOuts.length > 0 ? latestCallOuts[0].field_939 : '' //This is group by date, don't need time,
//       let date_of_install = measureOrInstallDetails[2] === 'Install' && latestCallOuts.length > 0 ? latestCallOuts[0].field_939 : ''
//       changeStatusInPortal(jobId, changeStateTo, measure_booked_date, date_of_install)
//     }
//   }
// }
