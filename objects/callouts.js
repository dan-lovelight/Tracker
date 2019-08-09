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
  if (job.field_12.length === 0) {
    job.field_12_raw = {}
    job.field_12_raw.street = 'TBA' // address is required field, prevents errors if the job field is blank
  }

  return updateData = copyFieldsToNewObject(job, fieldsToCopy)
}

// Create the display names for the call out
// Returns a partial callout object with all the necessary fields populated
async function getCallOutName(callOut, changes) {

  let nameUpdateField = [
    'field_1485', // Callout Type
    'field_1447', // 'Other' Type description
    'field_1633', // Calendar Event Type
    'field_928', // Jobs
    'field_1482', // Development
    'field_981', // Addresss
    'field_927', // Installers
  ]

  // Only continue if there have been report updates
  if (changes) {
    if(nameUpdateField.filter(field => changes.includes(field)).length===0) return {}
  }

  let type = callOut.field_1485
  let typeIcon = getCalloutTypeIcon(callOut)
  let multiInstallerIndicator = await getMultiInstallerIndicator(callOut)
  let confirmationIcon =  callOut.field_1633.substring(0,1)

  let jobsCount = callOut.field_928.length > 0 ? callOut.field_928_raw.length : 0
  let jobsCountDisplay = jobsCount > 1 ? '(+' + (jobsCount - 1) + ' others)' : ''
  let firstJob = jobsCount > 0 ? callOut.field_928_raw['0'].identifier : ''
  let firstJobNoNumbers = jobsCount > 0 ? firstJob.split('-').shift().replace(/[0-9]/g, '') + '-' + firstJob.split('-')['1'] : '' // strip numbers from job name
  let jobDisplay = firstJob.length < 1 ? '' : ` | ${firstJobNoNumbers} ${jobsCountDisplay}`

  let development = callOut.field_1482.length > 0 ? ' | ' + callOut.field_1482_raw['0'].identifier : ''
  let nameToDisplay = jobsCount > 0 ? jobDisplay : development

  let street = callOut.field_981.length > 0 ? callOut.field_981_raw.street + '' + callOut.field_981_raw.street2 : ''
  let city = callOut.field_981.length > 0 ? callOut.field_981_raw.city : ''
  let address = street + ' ' + city
  let addressDisplay = address.length < 2 ? '' : '| ' + address

  // Build Display Names
  let name = {}
  name.field_1488 = `${confirmationIcon}${typeIcon}${type}${nameToDisplay}`.trim() // Form display name
  name.field_1481 = `${multiInstallerIndicator}${name.field_1488}${addressDisplay}`.trim() // Calendar display name

  return name

  function getCalloutTypeIcon(callout){

    let typeOption = callout.field_925

    const typeIcons = [
      ['Unavailable/Leave', '🏄'],
      ['Install', '🔨'],
      ['Service & Install', '👷🔨'],
      ['Measure & Install', '📏🔨'],
      ['Measure', '📏'],
      ['Service Call', '👷'],
      ['Service', '👷'],
      ['Drop Off', '🚚'],
      ['Pick Up', '🚚'],
      ['Load', '💪'],
      ['Christmas', '🎄'],
      ['Drinks', '🍺'],
      ['Party', '🎉'],
      ['Take Down', '⬇']
    ]

    // Get type icon
    let icon =  typeIcons.reduce((icon, iconPair) => {
      icon += iconPair[0] === typeOption ? iconPair[1] : ''
      return icon
    }, '')

    const otherSearch = ['Take Down','Load','Party','Christmas','Drinks','Service','Measure','Install']

    if(typeOption === 'Other'){
      otherSearch.forEach(option =>{
        if(callout.field_1477.toLowerCase().indexOf(option.toLowerCase())>-1){
          icon += typeIcons.filter(iconPair => iconPair[0] === option)[0][1]
        }
      })
    }

    return icon

  }

  // Build indicator of multiple installers if this is required
  async function getMultiInstallerIndicator(callout){
    if (!callout.field_927_raw) return ''
    if(callout.field_927_raw.length < 2) return ''
      let installerIDs = getConnectionIDs(callout.field_927_raw)
      let installerFilter = createFilterFromArrayOfIDs(installerIDs)
      let installers = await searchRecordsPromise('object_71', installerFilter)
      return installers.reduce(function(colouredHeads, installer) {
        colouredHeads += '<span style="background-color:' + installer.field_1486 + '">👤</span>'
        return colouredHeads
      }, '')
  }

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


$(document).on('knack-view-render.any', function(event, view, data) {
  let calloutsObj
  // If a view is displaying callouts, add listners
  try {
    if (view.source) {
      if (view.source.object) {
        if (view.source.object === objects.callouts) {
          calloutsObj = new KnackObject(view.source.object, view)
          calloutsObj.onCreate(processNewCallOut)
          //calloutsObj.onUpdate()
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err)
  }
})

// Process newly created callouts
async function processNewCallOut(view, record, action, fields) {
  try {
    // Set processing flag
    window.callOutProcessing = true

    // Get name of user creating the record
    let user = Knack.getUserAttributes()
    let createdBy = {}
    createdBy.field_1581 = user.name // created by

    // Gather required updates to the callout record
    let names = await getCallOutName(record)
    let jobDetails = await getJobUpdates(record)
    let updateData = Object.assign({}, createdBy, names, jobDetails)

    // Update the callout
    let calloutsObj = new KnackObject(objects.callouts)
    await calloutsObj.update(record.id, updateData)

    // Update any connected portal records
    updateConnectedJobsInPortal(record)

  } catch (err) {
    Sentry.captureException(err)
  } finally {
    window.callOutProcessing = false
  }
}

// Process newly created callouts
async function processUpdatedCallOut(view, record, action, fields, previous, changes) {
  try {
    let names = await getCallOutName(record, changes)
    let jobDetails = await getJobUpdates(record, changes)

  } catch (err) {
    Sentry.captureException(err)
  } finally {

  }
}

async function handleInstallerReports(record, changes){

  let installerReportFields = [
    'field_1542', // Outcome
    'field_1547', // What went wrong?
    'field_1545', // Report details
    'field_1548', // Photos uploaded?
    'field_1549', // Docs uploaded?
    'field_1626', // Consumables supplied?
    'field_1627', // What was supplied?
    'field_1616', // Estimated install time
  ]

  // Only continue if there have been report updates
  if(installerReportFields.filter(field => changes.includes(field)).length===0) return

  // Record who submitted the report
  let calloutsObj = new KnackObject(objects.callouts)
  record = await calloutsObj.update(record.id,{'field_1632': Knack.getUserAttributes().name })

  let isFirstReport = previous.field_1546 === 'Pending'

  // Gather data for email.

}

function isEventCreationRequired(callout){
  // is it in the calendar already? Only continue if no
  // does the calendar type allow invites? && does the status require an invite?
  // Yes & Yes
}
function isEventDeletionRequired(callout){
  // is it in the calendar alreayd? Only continue if yes
  // does the calend type allow invites? --> cancel if no
  // does the status require an invite? ---> cancel if no
}
function isEventUpdateRequired(callout, changes){
  // if not create or delete
  // is it in the calendar?
  // has anything changed
}

function isEventDataUpdated(changes){
  if(isJobUpdated(changes)) return true
  // test everything else that can require an event update
}

function isJobUpdated(changes){
  if (changes.includes('field_928')) return true
  return false
}

// ['field_924', 'field_1026'], // Scheduled Date
// ['field_981', 'field_1478'], // Address
// ['field_955', 'field_1028'], // Status
// ['field_925', 'field_1492'], // Type
// ['field_927', 'field_1034'], // Installer
// ['field_1503', 'field_1506'] // Other attendees
// ]
//
// const trackChangeSalesOpsFields = [
// ['field_985', 'field_1504'], // Salesperson
// ['field_1474', 'field_1505'] // Ops person

// Get all relevant data from job to update callout details
// Returns a partial callout object with all the necessary fields populated
async function getJobUpdates(callOut, changes) {

  // If changes supplied, return early if no changes to job
  if (changes) {
    if (!isJobUpdated(changes)) return {}
  }

  // Return early if job is blank
  if (callOut.field_928.length === 0) return {}

  let fieldsToCopy = [
    ['field_1276', 'field_985'], // Salesperson
    ['field_1277', 'field_1474'], // Ops person
    ['field_58', 'field_1494'], // State
    ['field_186', 'field_1482'], // Development
    ['field_59', 'field_1495'], // Busines Unit
  ]

  // Get the job details
  let job = await getRecordPromise(objects.jobs, callOut.field_928_raw[0].id)

  // Preprocess the job data
  job.field_59_raw = (job.field_59 === 'Apartments' || job.field_59 === 'Projects') ? ['Commercial'] : [job.field_59] // we use 'Commercial' for scheulding
  if (job.field_12.length === 0) {
    job.field_12_raw = {}
    job.field_12_raw.street = 'TBA' // address is required field, prevents errors if the job field is blank
  }

  return updateData = copyFieldsToNewObject(job, fieldsToCopy)
}
