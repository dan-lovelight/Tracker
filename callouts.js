//***************************************************************************
//******************* WHEN CREATE/EDIT CALL OUT FORMS ARE RENDERED **********
//***************************************************************************

// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/add-a-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_641/views/view_1437
$(document).on('knack-view-render.view_1437', function(event, view, data) {
  pimpTimePicker('view_1437-field_924')
})

// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/edit-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_576/views/view_1294
$(document).on('knack-view-render.view_1294', function(event, view, data) {
  pimpTimePicker('view_1294-field_924')
});

// https://lovelight.knack.com/tracker#developments/view-development-details/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_1024/views/view_2126
$(document).on('knack-view-render.view_2126', function(event, view, data) {
  pimpTimePicker('view_2126-field_924')
});

// ***************************************************************************
// ******************* WHEN A CALL OUT IS UPDATED ****************************
// ***************************************************************************

// A list of key fields, with the live field and the 'previous' field
// The previous value is updated in code whenever there is a change
// This acts as a flag - any submission where the two fields differ
// indicates that the change is yet to be processed
const trackChangeCoreFields = [
  ['field_924', 'field_1026'], // Scheduled Date
  ['field_981', 'field_1478'], // Address
  ['field_955', 'field_1028'], // Status
  ['field_925', 'field_1492'], // Type
  ['field_927', 'field_1034'], // Installer
  ['field_1503', 'field_1506'] // Other attendees
]

const trackChangeSalesOpsFields = [
  ['field_985', 'field_1504'], // Salesperson
  ['field_1474', 'field_1505'] // Ops person
]

const trackChangeJobFields = [
  ['field_928', 'field_1493'], // Job
]

const trackChangeFields = trackChangeCoreFields.concat(trackChangeSalesOpsFields, trackChangeJobFields)

async function processCallOutChanges(record) {
  try {

    // Determine what changes have been made to the record
    let isCoreDataUpdated = isObjectUpdated(record, trackChangeCoreFields)
    let isSalesOpsUpdated = isObjectUpdated(record, trackChangeSalesOpsFields)
    let isAttendeeDataUpdated = record.field_1476.indexOf('Yes') ? isObjectUpdated(record, trackChangeSalesOpsFields) : false // Sales & Ops may not impact the calendar event
    let isJobUpdated = isObjectUpdated(record, trackChangeJobFields)
    let isCalendarFlagSet = record.field_1496 === 'Yes' // This will only be yes if an error has stopped the calendar update

    let isDataUpdateRequired = isCoreDataUpdated || isSalesOpsUpdated || isJobUpdated
    let isCalendarUpdateRequired = isCoreDataUpdated || isAttendeeDataUpdated || isJobUpdated || isCalendarFlagSet // always false if isDataUpdateRequired is false

    let updatedRecord = record

    // Update the callout data if required
    if (!isDataUpdateRequired) {
      console.log('No update required')
    } else {

      // Gather all data that needs to be updated as a result of the changes
      let resetData = copyFieldsToNewObject(record, trackChangeFields)
      let jobData = isJobUpdated ? await getJobDataForCallOut(record) : {}
      let nameData = await getCallOutName(record)
      let pendingCalendarUpdateFlag = isCalendarUpdateRequired ? {
        'field_1496': 'Yes'
      } : {} // Flag for update required, only reset on success

      // Merge the data
      let updateData = {
        ...resetData,
        ...jobData,
        ...nameData,
        ...pendingCalendarUpdateFlag
      }

      // Update the callout record
      updatedRecord = await updateRecordPromise('object_78', record.id, updateData)
      console.log('Record updated')
    }

    // Update calendar events if required
    if (!isCalendarUpdateRequired) {
      console.log('No calendar invites update required')
    } else {

      // Exit if there is an update in progress
      if (record.field_1101 === 'Yes') {
        console.log('Callendar updates cancelled because an update is arleady in progress')
        return
      }

      // Variables that tell us what we need to do this this callout
      let isConfirmed = record.field_955 === 'No' // If the callout is not 'Tentative' then it is isConfirmed
      let isInCalendar = record.field_1082.length > 1 // If the callout has a matching calendar item the id will be in this field
      let isCancelled = record.field_1005 === 'Cancelled'

      let isNewEventRequired = isConfirmed && !isInCalendar && !isCancelled
      let isEventUpdateRequired = isConfirmed && isInCalendar && !isCancelled
      let isEventCancellationRequired = isInCalendar && (!isConfirmed || isCancelled)

      if (isNewEventRequired) processGoogleEvent('new', updatedRecord)
      if (isEventUpdateRequired) processGoogleEvent('update', updatedRecord)
      if (isEventCancellationRequired) processGoogleEvent('delete', updatedRecord)

    }
    return
  }
  catch (err) {
    logError(processCallOutChanges, arguments, err, Knack.getUserAttributes(), window.location.href, false)
  }
}

// Get all relevant data from job to update callout details
// Returns a partial callout object with all the necessary fields populated
async function getJobDataForCallOut(callOut) {

  let trackJobChangeFields = [
    ['field_928', 'field_1493'] // Live jobs field, previous jobs field
  ]

  let fieldsToCopy = [
    ['field_1276', 'field_985'], // Salesperson
    ['field_1277', 'field_1474'], // Ops person
    ['field_58', 'field_1494'], // State
    ['field_186', 'field_1482'], // Development
    ['field_59', 'field_1495'], // Busines Unit
  ]

  let addressFieldsToCopy = [
    ['field_12', 'field_981'], // Address
    ['field_12', 'field_1478'], // Previous address (to remove has changed flag)
  ]

  let siteContactFieldsToCopy = [
    ['field_432', 'field_1025'] // Site contact
  ]

  // Return early if the job is not updated
  if (!isObjectUpdated(callOut, trackJobChangeFields)) {
    return {}
  }

  // Get the job details
  let job = await getRecordPromise('object_3', callOut.field_928_raw[0].id)

  // Add site contact to fiels to copy if required
  if (callOut.field_1024 === 'Yes') {
    fieldsToCopy = fieldsToCopy.concat(siteContactFieldsToCopy)
  }
  // Add address to fields to copy (and to previous address to remove flag) if required
  if (callOut.field_982 === 'Yes') {
    fieldsToCopy = fieldsToCopy.concat(addressFieldsToCopy)
  }

  // Preprocess the job business unit
  (job.field_59 === 'Apartments' || job.field_59 === 'Projects') ? job.field_59 = ['Commercial']: [job.field_59]

  return updateData = copyFieldsToNewObject(job, fieldsToCopy)
}

// Create the display names for the call out
// Returns a partial callout object with all the necessary fields populated
async function getCallOutName(callOut) {

  let name = {}

  const tentativeIcon = '❓'
  const completeIcon = '✔️'
  const scheduledIcon = '📆'
  const typeIcons = [
    ['Unavailable/Leave', '🏄'],
    ['Install', '🔨'],
    ['Service & Install', '👷🔨'],
    ['Measure & Install', '📏🔨'],
    ['Measure', '📏'],
    ['Service Call', '👷'],
    ['Drop Off', '🚚'],
    ['Pick Up', '🚚'],
  ]

  // Collect Name Variables
  let confirmationIcon = callOut.field_955 === 'No' ? '' : '[' + tentativeIcon + ']' // Show confirmed / tentative status
  let type = callOut.field_925 === 'Other' ? callOut.field_1477 : callOut.field_925 // The selected callout type - install, measure etc, unless type is 'other'
  let jobsCount = callOut.field_928.length > 0 ? callOut.field_928_raw.length : 0
  let jobsCountDisplay = jobsCount > 1 ? '(+' + (jobsCount - 1) + ' others)' : ''
  let firstJob = jobsCount > 0 ? callOut.field_928_raw['0'].identifier : ''
  let firstJobNoNumbers = jobsCount > 0 ? firstJob.split('-').shift().replace(/[0-9]/g, '') + '-' + firstJob.split('-')['1'] : '' // strip numbers from job name
  let jobDisplay = firstJob.length < 1 ? '' : `${firstJobNoNumbers} ${jobsCountDisplay}`
  let completionIcon = callOut.field_1005 === 'Complete' ? completeIcon : scheduledIcon
  let street = callOut.field_981.length > 0 ? callOut.field_981_raw.street : ''
  let city = callOut.field_981.length > 0 ? callOut.field_981_raw.city : ''
  let address = street + ' ' + city
  let addressDisplay = address.length < 2 ? '' : '| ' + address
  let installers = getConnectionIdentifiers(callOut.field_927_raw).join(', ')
  let development = callOut.field_1482.length > 0 ? callOut.field_1482_raw['0'].identifier : ''
  let nameToDisplay = jobsCount > 0 ? jobDisplay : development
  let typeIcon = ''
  let multiInstallerIndicator = ''

  // Get type icon
  typeIcon = typeIcons.reduce((icon, iconPair) => {
    icon += iconPair[0] === type ? iconPair[1] : ''
    return icon
  }, '')

  // Build indicator of multiple installers if this is required
  if (callOut.field_927_raw === undefined ? 0 : callOut.field_927_raw.length) {
    let installerIDs = getConnectionIDs(callOut.field_927_raw)
    let installerFilter = createFilterFromArrayOfIDs(installerIDs)
    let installers = await searchRecordsPromise('object_71', installerFilter)
    multiInstallerIndicator = installers.reduce(function(colouredHeads, installer) {
      colouredHeads += '<span style="background-color:' + installer.field_1486 + '">👤</span>'
      return colouredHeads
    }, '')
  }

  // Build Display Names
  name.field_1488 = `${confirmationIcon}${typeIcon}${type} | ${nameToDisplay}`.trim() // Form display name
  name.field_1481 = `${multiInstallerIndicator}${name.field_1488}${addressDisplay}`.trim() // Calendar display name
  name.field_1490 = `${confirmationIcon}${completionIcon} | ${typeIcon}${type} (${installers})` // Scheduled status and installers display

  return name
}

// Gather key callout data with human readable names
function getPrettyCallOut(callOut) {
  return {
    'id': callOut.id,
    'fromTime': callOut.field_924_raw.timestamp,
    'toTime': callOut.field_924_raw.to.timestamp,
    'jobs': callOut.field_928.length > 0 ? getConnectionIdentifiers(callOut.field_928_raw).join(', ') : undefined,
    'jobID': callOut.field_928.length > 0 ? callOut.field_928_raw['0'].id : undefined,
    'address': callOut.field_981.replace(/<\/?[^>]+(>|$)/g, ' '), // remove </br> from address string
    'type': callOut.field_925,
    'salesName': callOut.field_985.length > 0 ? callOut.field_985_raw['0'].identifier : undefined,
    'salesEmail': callOut.field_1081,
    'opsName': callOut.field_1474.length > 0 ? callOut.field_1474_raw['0'].identifier : undefined,
    'opsEmail': callOut.field_1475,
    'status': callOut.field_1005,
    'calendarID': callOut.field_1082,
    'installers': callOut.field_927.length > 0 ? getConnectionIdentifiers(callOut.field_927_raw).join(', ') : undefined,
    'attendees': callOut.field_1476.indexOf('Yes') ? [callOut.field_1503, callOut.field_1081, callOut.field_1475].join() : [callOut.field_1503],
    'productToInstall': callOut.field_954.length > 0 ? getConnectionIdentifiers(callOut.field_954_raw).join(', ') : undefined,
    'instructions': callOut.field_929,
    'displayName': callOut.field_1488
  }
}

// Returns a string of emails for the installers associated with a call out
async function getInstallerEmailsString(callout) {

  if (callout.field_927.length === 0) {
    throw new Error("Can't get installer emails without installer IDs")
  }

  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await searchRecordsPromise('object_71', installerFilter)

  return installers.reduce((emails, installer) => {
    emails.push(installer.field_870_raw.email)
    return emails
  }, []).join()

}

async function processGoogleEvent(eventAction, callOut) {

  // Target zaps that manage event changes
  let webhookArray = [{
      action: 'new',
      zap: 'xpuj8p',
      message: 'new event created'
    },
    {
      action: 'update',
      zap: 'xnc85h',
      message: 'event updated'
    },
    {
      action: 'delete',
      zap: 'xp4tzz',
      message: 'event deleted'
    }
  ]

  // Exit if no installers are invited - is a required field, shouldn't happen
  if (callOut.field_927.length === 0) {
    throw new Error("Can't create an event with no installers")
  }

  try {
    // Gather the data required for the event change
    let prettyCallOut = callOut
    if (eventAction !== 'delete') {
      prettyCallOut = getPrettyCallOut(callOut)
      prettyCallOut.attendees += (',' + await getInstallerEmailsString(callOut)) // Add installer emails to the attendee list
      // Add a record flag to indciate there's an update in progress to prevent race conditions
      await updateRecordPromise('object_78', callOut.id, {
        'field_1101': 'Yes'
      })
    }

    // Get the target zap
    let eventChange = webhookArray.find(zap => {
      return zap.action === eventAction
    })

    triggerZap(eventChange.zap, prettyCallOut, eventChange.message)

  } catch (err) {
    // Update is no longer in progress, reset the flag
    await updateRecordByID('object_78', callOut.id, {
      'field_1101': 'No'
    })
    console.log('error managing event changes:' + eventAction)
    logError(processCallOutChanges, arguments, err, Knack.getUserAttributes(), window.location.href, true)

  }
}

//***************************************************************************
//******************* ALL FORMS THAT UPDATE CALL OUTS ***********************
//***************************************************************************

//******************* RECORD CREATED ****************************************

// Add call out - job
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/add-a-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_641/views/view_1437
$(document).on('knack-record-create.view_1437', function(event, view, record) {
  processCallOutChanges(record);
});

// Add call out - development
// https://lovelight.knack.com/tracker#developments/view-development-details/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_1024/views/view_2126
$(document).on('knack-record-create.view_2126', function(event, view, record) {
  processCallOutChanges(record);
});

//******************* RECORD UPDATED ****************************************

// Edit Callout
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/edit-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_576/views/view_1294
$(document).on('knack-form-submit.view_1294', function(event, view, record) {
  processCallOutChanges(record);
});

// Review Callout
// https://lovelight.knack.com/tracker#call-outs/review-call-out-details2/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_638/views/view_1426
$(document).on('knack-form-submit.view_1426', function(event, view, record) {
  processCallOutChanges(record);
});

// Cancel Callout
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/cancel-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_690
$(document).on('knack-form-submit.view_1541', function(event, view, record) {
  processCallOutChanges(record);
});


//ReSync Callout
https: //builder.knack.com/lovelight/tracker#pages/scene_950/views/view_1967
  $(document).on('knack-form-submit.view_1967', function(event, view, record) {
    processCallOutChanges(record);
  });

//******************* RECORD DELETED ****************************************

$(document).on('knack-record-delete.view_1215', function(event, view, record) {
  processCallOutChanges(record);
});

//******************* SCHEDULING SCENES LOADED *****************************

//My CallOuts Calendar view for schedulers
$(document).on('knack-scene-render.scene_947', function(event, scene) {
  hideEmptyTables(scene)
});

//Developments page
$(document).on('knack-scene-render.scene_1023', function(event, scene) {
  hideEmptyTables(scene)
});


//VIC Calendar
$(document).on('knack-scene-render.scene_981', function(event, scene) {
  hideEmptyTables(scene)
});

//NSW Calendar
$(document).on('knack-scene-render.scene_982', function(event, scene) {
  hideEmptyTables(scene)
});

//QLD Calendar
$(document).on('knack-scene-render.scene_983', function(event, scene) {
  hideEmptyTables(scene)
});
