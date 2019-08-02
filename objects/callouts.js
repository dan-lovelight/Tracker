const callOutCreateEvents = [
  'knack-record-create.view_1437', // Add call out - job, #jobs/view-job-details/{id}/add-a-call-out/{id}/, #pages/scene_641/views/view_1437
  'knack-record-create.view_2126', // Add call out - development, #developments/view-development-details/{id}/, #pages/scene_1024/views/view_2126
  'knack-record-create.view_2199', // Add service call - job, #jobs/view-job-details2/{}/summary/{}/, #pages/scene_1054/views/view_2199
  'knack-record-create.view_2207', // Book time off - installers, #upcoming/add-leaveunavailable/, #pages/scene_1057/views/view_2207
  'knack-record-create.view_2254', // Request Measure - developments, #developments/view-development-details/{}/request-a-measure/{}/
  'knack-record-create.view_2258', // Request Install - developments, #developments/view-development-details/{}/request-an-install/{}/
]

const callOutUpdateEvents = [
  'knack-form-submit.view_1294', // Edit Callout, #jobs/view-job-details/{id}/edit-call-out/{id}/, #pages/scene_576/views/view_1294
  'knack-form-submit.view_1426', // Review Callout, #call-outs/review-call-out-details2/{id}/, #pages/scene_638/views/view_1426
  'knack-form-submit.view_1541', // Cancel Callout, #jobs/view-job-details/{id}/cancel-call-out/{id}/, #pages/scene_690
  'knack-form-submit.view_1967', // ReSync Callout, #pages/scene_950/views/view_1967
]

const callOutDeleteEvents = [
  'knack-record-delete.view_1215', // Callout Deleted,
]

// ----------------

const createEditDeleteCallOutViews = [
  // Create
  'knack-view-render.view_1437', // Add call out - job, #jobs/view-job-details/{id}/add-a-call-out/{id}/, #pages/scene_641/views/view_1437
  'knack-view-render.view_2126', // Add call out - development, #developments/view-development-details/{id}/, #pages/scene_1024/views/view_2126
  'knack-view-render.view_2199', // Add service call - job, #jobs/view-job-details2/{}/summary/{}/, #pages/scene_1054/views/view_2199
  // Update
  'knack-view-render.view_1294', // Edit Callout, #jobs/view-job-details/{id}/edit-call-out/{id}/, #pages/scene_576/views/view_1294
  'knack-view-render.view_1426', // Review Callout, #call-outs/review-call-out-details2/{id}/, #pages/scene_638/views/view_1426
  'knack-view-render.view_1541', // Cancel Callout, #jobs/view-job-details/{id}/cancel-call-out/{id}/, #pages/scene_690
  'knack-view-render.view_1967', // ReSync Callout, #pages/scene_950/views/view_1967
  // Delete
  'knack-view-render.view_1215', // Callout Deleted,
]

// CallOut created
$(document).on(callOutCreateEvents.join(' '), function(event, view, record) {
  processCallOutChanges(record, 'create');
  updateConnectedJobsInPortal(record)
});

// CallOut editted
$(document).on(callOutUpdateEvents.join(' '), function(event, view, record) {
  processCallOutChanges(record, 'update');
  updateConnectedJobsInPortal(record)
});

// CallOut changed
$(document).on(callOutDeleteEvents.join(' '), function(event, view, record) {
  processCallOutChanges(record, 'delete');
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

// Change type can be 'create', 'update' or 'delete'
async function processCallOutChanges(record, changeType) {
  try {

    // Set the default values
    let updatedRecord = record
    let isDataUpdateRequired = false // Don't try to update callout record unless we're sure one exists
    let isCalendarUpdateRequired = true // Always check if calendar needs updating unless explicity stopped
    let isCoreDataUpdated = false
    let isSalesOpsUpdated = false
    let isAttendeeDataUpdated = false
    let isJobUpdated = false
    let isCalendarFlagSet = false

    // Variables that tell us what we need to do this this callout
    let isConfirmed = record.field_955 === 'No' // If the callout is not 'Tentative' then it is isConfirmed
    let isInCalendar = record.field_1082.length > 1 // If the callout has a matching calendar item the id will be in this field
    let isCancelled = record.field_1005 === 'Cancelled'

    if (changeType !== 'delete') {
      // Determine what changes have been made to the record
      isCoreDataUpdated = isObjectUpdated(record, trackChangeCoreFields)
      isSalesOpsUpdated = isObjectUpdated(record, trackChangeSalesOpsFields)
      isAttendeeDataUpdated = record.field_1476.indexOf('Yes') > -1 ? isObjectUpdated(record, trackChangeSalesOpsFields) : false // Sales & Ops may not impact the calendar event
      isJobUpdated = isObjectUpdated(record, trackChangeJobFields)
      isCalendarFlagSet = record.field_1496 === 'Yes' // This will only be yes if an error has stopped the calendar update

      isDataUpdateRequired = isCoreDataUpdated || isSalesOpsUpdated || isJobUpdated
      isCalendarUpdateRequired = isCoreDataUpdated || isAttendeeDataUpdated || isJobUpdated || isCalendarFlagSet || isCancelled // always false if isDataUpdateRequired is false
    }

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
      let updateData = Object.assign({}, resetData, jobData, nameData, pendingCalendarUpdateFlag)

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

      // Handle installers who are allowed to see tentative bookings
      if (!isConfirmed) {
        if (updatedRecord.field_927.length > 0) { // can't do this without installers
          let permittedInstallers = await getInstallersWhoSeeTentativeBookings(updatedRecord)
          if (permittedInstallers.length > 0) {
            // We're sending this event anyway, but only to the installer permitted to see it
            updatedRecord.field_927_raw = permittedInstallers
            updatedRecord.field_1503 = '',
              updatedRecord.field_1081 = '',
              updatedRecord.field_1475 = ''

            isConfirmed = true
          }
        }
      }

      let isNewEventRequired = isConfirmed && !isInCalendar && !isCancelled
      let isEventUpdateRequired = isConfirmed && isInCalendar && !isCancelled
      let isEventCancellationRequired = isInCalendar && (!isConfirmed || isCancelled)

      if (isNewEventRequired) processGoogleEvent('new', updatedRecord)
      if (isEventUpdateRequired) processGoogleEvent('update', updatedRecord)
      if (isEventCancellationRequired) processGoogleEvent('delete', updatedRecord)

    }
    return
  } catch (err) {
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

  // Return early if the job is not updated
  if (!isObjectUpdated(callOut, trackJobChangeFields)) {
    return {}
  }

  // Get the job details
  let job = await getRecordPromise('object_3', callOut.field_928_raw[0].id)

  // Preprocess the job data
  job.field_59_raw = (job.field_59 === 'Apartments' || job.field_59 === 'Projects') ? ['Commercial'] : [job.field_59] // we use 'Commercial' for scheulding
  if (job.field_12.length === 0) job.field_12_raw.street = 'TBA' // address is required field, prevents errors if the job field is blank

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
  let jobDisplay = firstJob.length < 1 ? '' : ` | ${firstJobNoNumbers} ${jobsCountDisplay}`
  let completionIcon = callOut.field_1005 === 'Complete' ? completeIcon : scheduledIcon
  let street = callOut.field_981.length > 0 ? callOut.field_981_raw.street + '' + callOut.field_981_raw.street2 : ''
  let city = callOut.field_981.length > 0 ? callOut.field_981_raw.city : ''
  let address = street + ' ' + city
  let addressDisplay = address.length < 2 ? '' : '| ' + address
  let installers = getConnectionIdentifiers(callOut.field_927_raw).join(', ')
  let development = callOut.field_1482.length > 0 ? ' | ' + callOut.field_1482_raw['0'].identifier : ''
  let nameToDisplay = jobsCount > 0 ? jobDisplay : development
  let typeIcon = ''
  let multiInstallerIndicator = ''

  // Get type icon
  typeIcon = typeIcons.reduce((icon, iconPair) => {
    icon += iconPair[0] === type ? iconPair[1] : ''
    return icon
  }, '')

  // Build indicator of multiple installers if this is required
  if (callOut.field_927_raw !== undefined && callOut.field_927_raw.length > 1) {
    let installerIDs = getConnectionIDs(callOut.field_927_raw)
    let installerFilter = createFilterFromArrayOfIDs(installerIDs)
    let installers = await searchRecordsPromise('object_71', installerFilter)
    multiInstallerIndicator = installers.reduce(function(colouredHeads, installer) {
      colouredHeads += '<span style="background-color:' + installer.field_1486 + '">👤</span>'
      return colouredHeads
    }, '')
  }

  // Build Display Names
  name.field_1488 = `${confirmationIcon}${typeIcon}${type}${nameToDisplay}`.trim() // Form display name
  name.field_1481 = `${multiInstallerIndicator}${name.field_1488}${addressDisplay}`.trim() // Calendar display name
  name.field_1490 = `${confirmationIcon}${completionIcon} | ${typeIcon}${type} (${installers})` // Scheduled status and installers display

  return name
}

// Gather key callout data with human readable names
async function getPrettyCallOut(callOut) {
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
    'attendees': await getAttendees(callOut),
    'productToInstall': callOut.field_954.length > 0 ? getConnectionIdentifiers(callOut.field_954_raw).join(', ') : undefined,
    'instructions': callOut.field_929,
    'displayName': callOut.field_1488
  }
}

async function getAttendees(callOut) {
  let isConfirmed = callOut.field_955 === 'No' // If the callOut is not 'Tentative' then it is isConfirmed
  let attendees = ''
  // Get installers, need them whether confirmed or not
  let installerIDs = getConnectionIDs(callOut.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await searchRecordsPromise('object_71', installerFilter)

  // if confiremd, return everyone who should see event
  if (isConfirmed) {
    installers = installers.map(installer => installer.field_870_raw.email).join(',')
    let salesperson = ''
    let opsperson = ''

    // Get sales and ops if they are to be emailed
    if (callOut.field_1476.indexOf('Yes') > -1) {
      if (callOut.field_985_raw) {
        if (callOut.field_985_raw.length > 0) {
          let salesId = [callOut.field_985_raw[0].id]
          let salesFilter = createFilterFromArrayOfIDs(salesId)
          salesperson = await searchRecordsPromise('object_82', salesFilter)
          salesperson = salesperson.filter(sales => sales.field_1596 !== 'Yes')[0] || ''
          if (salesperson.field_957_raw) {
            salesperson = salesperson.field_957_raw.email
          }
        }
      }

      if (callOut.field_1474_raw) {
        if (callOut.field_1474_raw.length > 0) {
          let opsId = [callOut.field_1474_raw[0].id]
          let opsFilter = createFilterFromArrayOfIDs(opsId)
          opsperson = await searchRecordsPromise('object_68', opsFilter)
          opsperson = opsperson.filter(ops => ops.field_1597 !== 'Yes')[0] || ''
          if (opsperson.field_814_raw) {
            opsperson = opsperson.field_814_raw.email
          }
        }
      }
    }

    // replace semiconons and spaces in other attendeeds with commas
    let otherAttendees = callOut.field_1503.replace(/;/g, ',').replace(/ /g, ',')

    attendees = [installers, salesperson, opsperson, otherAttendees].join(',')
    return attendees

  } else {
    installers = installers.filter(installer => installer.field_1565 === 'Yes')
    installers = installers.map(installer => installer.field_870_raw.email).join(',')
    return installers
  }

}

// Returns a string of emails for the installers associated with a call out
async function getInstallersWhoSeeTentativeBookings(callout) {

  if (callout.field_927.length === 0) {
    throw new Error("Can't get installer emails without installer IDs")
  }

  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await searchRecordsPromise('object_71', installerFilter)

  return installers.reduce((ids, installer) => {
    if (installer.field_1565 === 'Yes') {
      ids.push({
        'id': installer.id,
        'identifier': installer.field_869
      })
    }
    return ids
  }, [])
}

// Returns a string of emails for the installers associated with a call out
async function getInstallerEmailsString(callout) {

  if (callout.field_927.length === 0) {
    throw new Error("Can't get installer emails without installer IDs")
  }

  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await searchRecordsPromise('object_71', installerFilter) // Why does this return an empty array?

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
      prettyCallOut = await getPrettyCallOut(callOut)
      // prettyCallOut.attendees += (',' + await getInstallerEmailsString(callOut)) // Add installer emails to the attendee list
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
    await updateRecordPromise('object_78', callOut.id, {
      'field_1101': 'No'
    })
    console.log('error managing event changes:' + eventAction)
    logError(processCallOutChanges, arguments, err, Knack.getUserAttributes(), window.location.href, true)

  }
}

// Update commercial jobs connected callouts if callout is Install or Measure
function updateConnectedJobsInPortal(record) {

  const portalToTrackerMap = [
    //portal status name, callout type name,
    ['measure_booked', 'Measure'],
    ['install_booked', 'Install']
  ]

  let isConnectedToJob = record.field_928.length > 0
  let isConfirmed = record.field_1005 !== 'Tentative'
  let isCommercial = record.field_1495.indexOf('Commercial') > -1
  let isCancelled = record.field_1005 === 'Cancelled'

  // Exit early if there is no job or the callout is tentative or it's not a commercial job
  if (!(isConnectedToJob && isConfirmed && isCommercial) || isCancelled) {
    return
  }

  let callOutType = record.field_925
  let changeDetails = portalToTrackerMap.filter((type) => type[1] === callOutType)[0]
  // Proceed if the callout type is measure or an install
  if (changeDetails !== undefined) {
    record.field_928_raw.forEach(job => {
      let measureDate = changeDetails[1] = 'Measure' ? record.field_939 : ''
      let installDate = changeDetails[1] = 'Install' ? record.field_939 : ''
      changeStatusInPortal(job.id, changeDetails[0], measureDate, installDate)
    })
  }
}


// $(document).on('knack-view-render.any', function(event, view, data) {
//
//   try {
//     if (view.source) {
//       if (view.source.object) {
//         if(view.source.object === objects.callouts){
//           let callouts = new KnackObject(view.source.object, view)
//         }
//       }
//     }
//   } catch (error) {
//     throw error
//   }
//
// })

// async function processCallout(view, record, action, fields, previousRecord, changes) {
//   try {
//
//     // Set the default values
//     let isDataUpdateRequired = false // Don't try to update callout record unless we're sure one exists
//     let isCalendarUpdateRequired = true // Always check if calendar needs updating unless explicity stopped
//     let isCoreDataUpdated = false
//     let isSalesOpsUpdated = false
//     let isAttendeeDataUpdated = false
//     let isJobUpdated = false
//     let isCalendarFlagSet = false
//
//     // Variables that tell us what we need to do this this callout
//     let isConfirmed = record.field_955 === 'No' // If the callout is not 'Tentative' then it is isConfirmed
//     let isInCalendar = record.field_1082.length > 1 // If the callout has a matching calendar item the id will be in this field
//     let isCancelled = record.field_1005 === 'Cancelled' || action === 'Delete'
//
//     let keyFields = [
//       'field_924', // Scheduled Date
//       'field_981', // Address
//       'field_955', // Status
//       'field_925', // Type
//       'field_927', // Installer
//       'field_1503' // Other attendees
//     ]
//
//     const salesOpsFields = [
//       'field_985', // Salesperson
//       'field_1474', // Ops person
//     ]
//
//     if (action !== 'Delete') {
//       // Determine what changes have been made to the record
//       isCoreDataUpdated = keyFields.filter(field => changes.includes(field)).length > 1
//       isSalesOpsUpdated = salesOpsFields.filter(field => changes.includes(field)).length > 1
//       isAttendeeDataUpdated = record.field_1476.indexOf('Yes') > -1 ? isObjectUpdated(record, trackChangeSalesOpsFields) : false // Sales & Ops may not impact the calendar event
//       isJobUpdated = isObjectUpdated(record, trackChangeJobFields)
//       isCalendarFlagSet = record.field_1496 === 'Yes' // This will only be yes if an error has stopped the calendar update
//
//       isDataUpdateRequired = isCoreDataUpdated || isSalesOpsUpdated || isJobUpdated
//       isCalendarUpdateRequired = isCoreDataUpdated || isAttendeeDataUpdated || isJobUpdated || isCalendarFlagSet || isCancelled // always false if isDataUpdateRequired is false
//     }
//
//     // Update the callout data if required
//     if (!isDataUpdateRequired) {
//       console.log('No update required')
//     } else {
//
//       // Gather all data that needs to be updated as a result of the changes
//       let resetData = copyFieldsToNewObject(record, trackChangeFields)
//       let jobData = isJobUpdated ? await getJobDataForCallOut(record) : {}
//       let nameData = await getCallOutName(record)
//       let pendingCalendarUpdateFlag = isCalendarUpdateRequired ? {
//         'field_1496': 'Yes'
//       } : {} // Flag for update required, only reset on success
//
//       // Merge the data
//       let updateData = {
//         ...resetData,
//         ...jobData,
//         ...nameData,
//         ...pendingCalendarUpdateFlag
//       }
//
//       // Update the callout record
//       updatedRecord = await updateRecordPromise('object_78', record.id, updateData)
//       console.log('Record updated')
//     }
//
//     // Update calendar events if required
//     if (!isCalendarUpdateRequired) {
//       console.log('No calendar invites update required')
//     } else {
//
//       // Exit if there is an update in progress
//       if (record.field_1101 === 'Yes') {
//         console.log('Callendar updates cancelled because an update is arleady in progress')
//         return
//       }
//
//       // Handle installers who are allowed to see tentative bookings
//       if (!isConfirmed) {
//         let permittedInstallers = await getInstallersWhoSeeTentativeBookings(updatedRecord)
//         if (permittedInstallers.length > 0) {
//           // We're sending this event anyway, but only to the installer permitted to see it
//           updatedRecord.field_927_raw = permittedInstallers
//           updatedRecord.field_1503 = '',
//             updatedRecord.field_1081 = '',
//             updatedRecord.field_1475 = ''
//
//           isConfirmed = true
//         }
//       }
//
//       let isNewEventRequired = isConfirmed && !isInCalendar && !isCancelled
//       let isEventUpdateRequired = isConfirmed && isInCalendar && !isCancelled
//       let isEventCancellationRequired = isInCalendar && (!isConfirmed || isCancelled)
//
//       if (isNewEventRequired) processGoogleEvent('new', updatedRecord)
//       if (isEventUpdateRequired) processGoogleEvent('update', updatedRecord)
//       if (isEventCancellationRequired) processGoogleEvent('delete', updatedRecord)
//
//     }
//     return
//   } catch (err) {
//     logError(processCallOutChanges, arguments, err, Knack.getUserAttributes(), window.location.href, false)
//   }
// }
