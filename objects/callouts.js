// -------------------------------------------------------
// Start Listener
$(document).on('knack-view-render.any', function(event, view, data) {
  let calloutsObj
  // If a view is displaying callouts, add listners
  try {
    if (view.source) {
      if (view.source.object) {
        if (view.source.object === objects.callouts) {
          calloutsObj = new KnackObject(view.source.object, view)
          calloutsObj.onCreate(processNewCallOut)
          calloutsObj.onUpdate(processUpdatedCallOut)
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err)
  }
})
// End Listner

// -------------------------------------------------------
// Start Handlers

// Process newly created callouts
async function processNewCallOut(view, callout, action, fields) {
  try {
    // Set processing flag
    window.callOutProcessing = true

    // Get name of user creating the callout
    let user = Knack.getUserAttributes()
    let createdBy = {}
    createdBy.field_1581 = user.name // created by

    // Gather required updates to the callout callout
    let names = await getCallOutName(callout)
    let jobDetails = await getJobUpdates(callout)
    let updateData = Object.assign({}, createdBy, names, jobDetails)

    // Add 'Calendar update required' flag if required
    if (isEventCreationRequired(callout)) updateData.field_1496 = 'Yes'

    // Update the callout
    let calloutsObj = new KnackObject(objects.callouts)
    callout = await calloutsObj.update(callout.id, updateData)

    handleCalendarUpdates(callout, callout, [])
    updateConnectedJobsInPortal(callout) // Update any connected portal callouts

  } catch (err) {
    Sentry.captureException(err)
  } finally {
    window.callOutProcessing = false
  }
}

// Process updated callouts
async function processUpdatedCallOut(view, callout, action, fields, previous, changes) {
  try {

    let names = await getCallOutName(callout, changes)
    let jobDetails = await getJobUpdates(callout, changes)
    let updateData = Object.assign({}, names, jobDetails)

    // Add 'Calendar update required' flag if required
    if (isGoogleCalendarActionRequired(callout, previous, changes)) updateData.field_1496 = 'Yes'

    // If there are changes, update the callout
    if (!$.isEmptyObject(updateData)) {
      let calloutsObj = new KnackObject(objects.callouts)
      callout = await calloutsObj.update(callout.id, updateData)
    }

    handleCalendarUpdates(callout, previous, changes)
    handleInstallerReports(callout, previous, changes)

    // Update any connected portal records
    updateConnectedJobsInPortal(callout)

  } catch (err) {
    Sentry.captureException(err)
    throw new Error(err)
  } finally {

  }
}
// End Handlers

// -------------------------------------------------------
// Start Calendar Management Functions

// Creates, updates or deletes synced calendar event if required
async function handleCalendarUpdates(callout, previous, changes) {

  if (!isGoogleCalendarActionRequired(callout, previous, changes)) return // Exit if we somehow got here when a update is not required
  await applyCalendarUpdateFlag(callout) // Add flag to stop race conditions

  // Get data that describes the event in a human readable way
  let eventData = getCalendarEventData(callout)

  if (isEventDeletionRequired(callout)) return triggerZap('xp4tzz', eventData)

  // If creating or updating, will need attendees
  eventData.attendees = await getAttendees(callout)

  if (isEventCreationRequired(callout)) return triggerZap('xpuj8p', eventData)
  if (isEventUpdateRequired(callout, previous, changes)) return triggerZap('xnc85h', eventData)

}

// Applies a calendar flag to a Knack record to prevent race conditions
async function applyCalendarUpdateFlag(callout){
  let calloutsObj = new KnackObject(objects.callouts)
  let updateData = {}
  updateData.field_1101 = 'Yes' // Add 'Calendar Update In Progress Flag' to avoid race conditions
  await calloutsObj.update(callout.id, updateData)
}

// End Calendar Management Functions

// ----------------------------------------------------------
// Start Helper Functions

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
    if (nameUpdateField.filter(field => changes.includes(field)).length === 0) return {}
  }

  let type = callOut.field_1485
  let typeIcon = getCalloutTypeIcon(callOut)
  let multiInstallerIndicator = await getMultiInstallerIndicator(callOut)
  let confirmationIcon = callOut.field_1633.indexOf('Confirmed')>-1 ? '' : callOut.field_1633.substring(0, 1)

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

}

function getCalloutTypeIcon(callout) {

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
    ['Take Down', '👇']
  ]

  // Get type icon
  let icon = typeIcons.reduce((icon, iconPair) => {
    icon += iconPair[0] === typeOption ? iconPair[1] : ''
    return icon
  }, '')

  const otherSearch = ['Take Down', 'Load', 'Party', 'Christmas', 'Drinks', 'Service', 'Measure', 'Install']

  if (typeOption === 'Other') {
    otherSearch.forEach(option => {
      if (callout.field_1477.toLowerCase().indexOf(option.toLowerCase()) > -1) {
        icon += typeIcons.filter(iconPair => iconPair[0] === option)[0][1]
      }
    })
  }

  return icon

}

// Build indicator of multiple installers if this is required
async function getMultiInstallerIndicator(callout) {
  if (!callout.field_927_raw) return ''
  if (callout.field_927_raw.length < 2) return ''
  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await searchRecordsPromise('object_71', installerFilter)
  return installers.reduce(function(colouredHeads, installer) {
    colouredHeads += '<span style="background-color:' + installer.field_1486 + '">👤</span>'
    return colouredHeads
  }, '')
}

// Get all relevant data from job to update callout details
// Returns a partial callout object with all the necgessary fields populated
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

// Gather key callout data with human readable names
function getCalendarEventData(callout) {
  return {
    'id': callout.id,
    'fromTime': callout.field_924_raw.timestamp,
    'toTime': callout.field_924_raw.to.timestamp,
    'jobs': callout.field_928.length > 0 ? getConnectionIdentifiers(callout.field_928_raw).join(', ') : undefined,
    'address': callout.field_981.replace(/<\/?[^>]+(>|$)/g, ' '), // remove </br> from address string
    'calendarID': callout.field_1082,
    'installers': callout.field_927.length > 0 ? getConnectionIdentifiers(callout.field_927_raw).join(', ') : undefined,
    'productToInstall': callout.field_954.length > 0 ? getConnectionIdentifiers(callout.field_954_raw).join(', ') : undefined,
    'instructions': callout.field_929,
    'displayName': callout.field_1488
  }
}

// Returns a comma separated string of email addresses
async function getAttendees(callout){
  let attendees = []
  attendees.push(await getInstallerEmails(callout))
  attendees.push(await getSalesEmail(callout))
  attendees.push(await getOpsEmail(callout))
  attendees.push(await getOtherAttendeeEmails(callout))
  attendees = attendees.join(',').trim()
  if(attendees.replace(/,/g, ',').length===0) throw new Error("Can't create event without any attendees")
  return attendees
}

// Returns a comma separated string of email addresses
async function getInstallerEmails(callout){
  let installersObj = new KnackObject(objects.installers)
  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await installersObj.find(installerFilter)
  return installers.map(installer => installer.field_870_raw.email).join(',')
}

// Checks for inclusion and salesperson opt out
// Returns an email address
async function getSalesEmail(callout){
  if(!callout.field_985_raw || !callout.field_985_raw[0]) return // there is no salesperson on the callout
  if (callout.field_1476.indexOf('Yes') === -1) return '' // we're not emailing them
  let salespeopleObj = new KnackObject(objects.salespeople)
  let salesperson = salespeopleObj.get(callout.field_985_raw[0].id)
  if (salesperson.field_1596 === 'Yes') return '' // they've opted out of event emails
  if (salesperson.field_957_raw) return salesperson.field_957_raw.email
  return ''
}

// Checks for inclusion and opsperson opt out
// Returns an email address
async function getOpsEmail(callout){
  if(!callout.field_1474_raw || !callout.field_1474_raw[0]) return // there is no ops on the callout
  if (callout.field_1476.indexOf('Yes') === -1) return '' // we're not emailing them
  let opspeopleObj = new KnackObject(objects.opspeople)
  let opsperson = opspeopleObj.get(callout.field_1474_raw[0].id)
  if (opsperson.field_1597 === 'Yes') return '' // they've opted out of event emails
  if (opsperson.field_814_raw) return opsperson.field_814_raw.email
  return ''
}

// Returns a comma separated string of email addresses
function getOtherAttendeeEmails(callout){
  return callout.field_1503.replace(/;/g, ',').replace(/ /g, ',')
}

// End Helper Functions

// ----------------------------------------------------------
// Start Boolean Helper Functions

function isGoogleCalendarActionRequired(callout, previous, changes) {
  if (callout.field_1101 === 'Yes') return false // there's already an update in progress
  if (isEventCreationRequired(callout) || isEventDeletionRequired(callout) || isEventUpdateRequired(callout, previous, changes)) return true
  return false
}

function isEventCreationRequired(callout) {
  if (callout.field_1082.length > 1) return false // if it's already in the calendar, don't create
  if (!isEventTypeInviteable(callout)) return false // if not an invitable type, no need to create
  if (isCalloutStatusInviteable(callout)) {
    console.log('isEventCreationRequired = true')
    return true
  } // given above two checks, if invitable status, create required
  return false // else return false
}

function isEventDeletionRequired(callout) {
  if (callout.field_1082.length === 0) return false // if it's not in the calendar, no need to delete
  if (!isEventTypeInviteable(callout) || !isCalloutStatusInviteable(callout)) {
    // if it's not an inviteable type, need to delete it
    // if it's not an inviteable status, need to delete it
    console.log('isEventDeletionRequired = true')
    return true
  }
  return false // else return false
}

function isEventUpdateRequired(callout, previous, changes) {
  if (isEventCreationRequired(callout) || isEventDeletionRequired(callout)) return false // don't update if creating or deleting
  if (callout.field_1082.length === 0) return false // if it's not in the calendar, no need to udpate
  if (isEventDataUpdated(callout, previous, changes)) {
    console.log('isEventUpdateRequired = true')
    return true
  } // if data the impacts the event is changed, need to update it
  return false // else return false
}

function isEventTypeInviteable(callout) {
  let inviteableTypes = ['✔️ Confirmed', '❔ Tentative - but still send invites']
  if (inviteableTypes.includes(callout.field_1633)) return true
  return false
}

function isCalloutStatusInviteable(callout) {
  let inviteableStatuses = ['Scheduled', 'Tentative']
  if (inviteableStatuses.includes(callout.field_1005)) return true
  return false
}

function isEventDataUpdated(callout, previous, changes) {
  if (isJobUpdated(changes)) return true
  if (isScheduledDateUpdated(changes)) return true
  if (isAddressUpdated(changes)) return true
  if (isTypeUpdated(changes)) return true
  if (isInstallerUpdated(changes)) return true
  if (isOtherAttendeesUpdated(changes)) return true
  if (isSalesUpdated(callout, previous, changes)) return true
  if (isOpsUpdated(callout, previous, changes)) return true
  return false
}

function isJobUpdated(changes) {
  if (changes.includes('field_928')) return true
  return false
}

function isScheduledDateUpdated(changes) {
  if (changes.includes('field_924')) return true
  return false
}

function isAddressUpdated(changes) {
  if (changes.includes('field_981')) return true
  return false
}

function isTypeUpdated(changes) {
  if (changes.includes('field_1485')) return true
  return false
}

function isInstallerUpdated(changes) {
  if (changes.includes('field_927')) return true
  return false
}

function isOtherAttendeesUpdated(changes) {
  if (changes.includes('field_1503')) return true
  return false
}

function isSalesUpdated(callout, previous, changes) {
  if (changes.includes('field_1476')) { // if include sales toggle has changed
    if (callout.field_985.length > 0 || previous.field_985.length > 0) return true // return true if there is (or was) a sales person
  }
  if (changes.includes('field_985')) { // given include toggle hasn't changed, if salesperson is updated
    if (callout.field_1476.indexOf('Yes') > -1) return true // return true if they are to be included
  }
  return false
}

function isOpsUpdated(callout, previous, changes) {
  if (changes.includes('field_1476')) { // if include sales toggle has changed
    if (callout.field_1474.length > 0 || previous.field_1474.length > 0) return true // return true if there is (or was) a sales person
  }
  if (changes.includes('field_1474')) { // given include toggle hasn't changed, if salesperson is updated
    if (callout.field_1476.indexOf('Yes') > -1) return true // return true if they are to be included
  }
  return false
}

function isReportUpdated(changes) {

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
  if (installerReportFields.filter(field => changes.includes(field)).length>0) return true
  return false
}

// End Boolean Helper Functions

// ----------------------------------------------------------
// Start Related Functions

// Update commercial jobs connected to callouts if callout is Install or Measure
function updateConnectedJobsInPortal(record) {

  const portalToTrackerMap = [
    //portal status name, callout type name,
    ['measure_booked', 'Measure'],
    ['install_booked', 'Install']
  ]

  if (record.field_1635 === 'No') return // record wasn't created by the portal

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

async function handleInstallerReports(record, previous, changes) {

  if(!isReportUpdated(changes)) return

  // Record who submitted the report
  let calloutsObj = new KnackObject(objects.callouts)
  record = await calloutsObj.update(record.id, {
    'field_1632': Knack.getUserAttributes().name
  })

  let isFirstReport = previous.field_1546 === 'Pending'

  // Gather data for email.

}
