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

async function processNewJobNote({
  record: note
}) {
  try {
    let user = Knack.getUserAttributes()
    let data = {}
    data.field_1655 = user.name // created by
    data.field_1652 = '' // Remove notes, these have been copied to an activity record


    // Update the note
    let noteObj = new KnackObject(objects.activityRecords)
    await noteObj.update(note.id, data)

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
    let isThereANote = isJobNoteAdded(job)
    let isStatusUpdated = isJobStatusUpdated(changes)
    let isValueUpdated = isJobValueUpdated(changes)
    let notes = []
    let data = {}

    data.field_1655 = user.name // Create by
    data.field_579 = [job.id]

    if (isNewJob) {
      // Insert job created record
      data.field_1659 = ['5d8c093bfc02f50011364c1e'] // Job Created
      data.field_576 = `Job created from ${view.name} form`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isThereANote) {
      // Insert a note record
      data.field_1659 = ['5d8c078bdb00f0001095e39d'] // Note
      data.field_576 = job.field_1652 // Note details
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isStatusUpdated) {
      let status = job.field_field_245
      if (status.indexOf('Complete') > -1) {
        // Insert a job completed record
        data.field_1659 = ['5d9435e24dbdf0001041faec'] // Job Completed
        data.field_576 = `Status changed from ${previous.field_245_raw[0].identifier.split(' - ')[1]} to ${job.field_245_raw[0].identifier.split(' - ')[1]}`
        notes.push(JSON.parse(JSON.stringify(data)))
      } else {
        // Insert a status change record
        data.field_1659 = ['5d8c0d5622d07d0010b41b9e'] // Status Change
        data.field_576 = `Status changed from ${previous.field_245_raw[0].identifier.split(' - ')[1]} to ${job.field_245_raw[0].identifier.split(' - ')[1]}`
        notes.push(JSON.parse(JSON.stringify(data)))
      }
    }

    if (isValueUpdated) {
      // Insert a value change record
      data.field_1659 = ['5d8c0e42ca31bf0010deb365'] // Value Change
      data.field_576 = `Job value changed from ${previous.field_130} to ${job.field_130}`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    // Insert the notes if there are any
    if (notes.length > 0) addActivityRecords(notes)
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

function isJobNoteAdded(job) {
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
    'value': job.field_130_raw ? job.field_130_raw.replace(/,/g, '') : 0,
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
