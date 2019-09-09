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

    handleCalendarUpdates(callout)
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
    let reportSubmitter = isReportUpdated(changes) ? {'field_1632': Knack.getUserAttributes().name} : {}
    let updateData = Object.assign({}, names, jobDetails, reportSubmitter)

    // Add 'Calendar update required' flag if required
    // Remove this with calendar migration. The update and result will be availaibe in the same call, no need to set the flag in advance.
    if (isGoogleCalendarActionRequired(callout, previous, changes)) updateData.field_1496 = 'Yes'

    // If there are changes, update the callout
    if (!$.isEmptyObject(updateData)) {
      let calloutsObj = new KnackObject(objects.callouts)
      callout = await calloutsObj.update(callout.id, updateData)
    }

    handleCalendarUpdates(callout)
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
async function handleCalendarUpdates(callout) {

  let isEventFlagged = callout.field_1101 === 'Yes'
  let isCreate = isEventCreationRequired(callout)
  let isUpdate = isEventDeletionRequired(callout)
  let isCancel = isEventDeletionRequired(callout)

  if (isEventFlagged) return // there's already an update in progress
  if(!(isCreate || isUpdate || isCancel)) return // Exit if we somehow got here when a update is not required

  await applyCalendarUpdateFlag(callout) // Add flag to stop race conditions

  // Get data that describes the event in a human readable way
  let eventData = getCalendarEventData(callout)

  if (isCancel) {
    cancelEvent(callout)
    return triggerZap('xp4tzz', eventData)
  }

  // If creating or updating, will need attendees
  eventData.attendees = await getAttendees(callout)

  if (isCreate) {
    createEvent(callout)
    return triggerZap('xpuj8p', eventData)
  }

  if (isUpdate) {
    updateEvent(callout)
    return triggerZap('xnc85h', eventData)
  }

}

async function createEvent(callout) {
  let calloutObj = new KnackObject(objects.callouts)
  let queryParams = ['sendUpdates=all']
  let body = await buildGCalEventBody(callout)
  let params = {
    method: 'POST',
    headers: window.calendarHeaders,
    body: JSON.stringify(body)
  }
  try {
    let gCalEventDetails = await lovelightCalendarService(params, queryParams)
    calloutObj.update(callout.id, {
      'field_1638': gCalEventDetails.id, // remove the event ID
    })
    return gCalEventDetails
  } catch (err) {
    // calloutObj.update(callout.id, {
    //   'field_1496': 'yes', // flag that an update is still required
    // })
    alert(`There was an error creating ${callout.field_1488}.If it continues after a couple of attempts, let Dan know!`)
    throw err
  }
}

async function updateEvent(callout) {
  let calloutObj = new KnackObject(objects.callouts)
  let eventId = callout.field_1082
  let queryParams = ['sendUpdates=all']
  let body = await buildGCalEventBody(callout)
  let params = {
    method: 'PATCH',
    headers: window.calendarHeaders,
    body: JSON.stringify(body)
  }
  try {
    return gCalEventDetails = await lovelightCalendarService(params, queryParams, eventId)
  } catch (err) {
    // calloutObj.update(callout.id, {
    //   'field_1496': 'yes', // flag that an update is still required
    // })
    alert(`There was an error updating ${callout.field_1488}.If it continues after a couple of attempts, let Dan know!`)
    throw err
  }
}

async function cancelEvent(callout) {
  let calloutObj = new KnackObject(objects.callouts)
  let eventId = callout.field_1082
  let queryParams = ['sendUpdates=all']
  let body = {
    'status': 'cancelled'
  }
  let params = {
    method: 'PATCH',
    headers: window.calendarHeaders,
    body: JSON.stringify(body)
  }
  try {
    let gCalEventDetails = await lovelightCalendarService(params, queryParams, eventId)
    calloutObj.update(callout.id, {
      'field_1638': '0', // remove the event ID
    })
    return gCalEventDetails
  } catch (err) {
    // calloutObj.update(callout.id, {
    //   'field_1496': 'yes', // flag that an update is still required
    // })
    alert(`There was an error cancelling ${callout.field_1488}.If it continues after a couple of attempts, let Dan know!`)
    throw err
  }
}

async function lovelightCalendarService(params, queryParams, eventId) {

  let url = 'https://wk949u5xcb.execute-api.ap-southeast-2.amazonaws.com/prod/v1/calendar/events'
  url += eventId ? '/' + eventId : ''
  url += queryParams ? '?' + queryParams.join('&') : ''

  let response = await fetch(url, params)
  if (!response.ok) throw Error(response.statusText)
  let json = await response.json()
  return json
}

// Applies a calendar flag to a Knack record to prevent race conditions
async function applyCalendarUpdateFlag(callout) {
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
async function getCallOutName(callout, changes) {

  let nameUpdateField = [
    'field_1485', // callout Type
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

  let type = callout.field_1485
  let typeIcon = getCalloutTypeIcon(callout)
  let multiInstallerIndicator = await getMultiInstallerIndicator(callout)
  let confirmationIcon = callout.field_1633.indexOf('Confirmed') > -1 ? '' : callout.field_1633.substring(0, 1)

  let jobsCount = callout.field_928.length > 0 ? callout.field_928_raw.length : 0
  let jobsCountDisplay = jobsCount > 1 ? '(+' + (jobsCount - 1) + ' others)' : ''
  let firstJob = jobsCount > 0 ? callout.field_928_raw['0'].identifier : ''
  let firstJobNoNumbers = jobsCount > 0 ? firstJob.split('-').shift().replace(/[0-9]/g, '') + '-' + firstJob.split('-')['1'] : '' // strip numbers from job name
  let jobDisplay = firstJob.length < 1 ? '' : ` | ${firstJobNoNumbers} ${jobsCountDisplay}`

  let development = callout.field_1482.length > 0 ? ' | ' + callout.field_1482_raw['0'].identifier : ''
  let nameToDisplay = jobsCount > 0 ? jobDisplay : development

  let street = callout.field_981.length > 0 ? callout.field_981_raw.street + '' + callout.field_981_raw.street2 : ''
  let city = callout.field_981.length > 0 ? callout.field_981_raw.city : ''
  let address = street + ' ' + city
  let addressDisplay = address.length < 2 ? '' : '| ' + address

  // Build Display Names
  let name = {}
  name.field_1488 = `${confirmationIcon}${typeIcon}${type}${nameToDisplay}`.trim() // Form display name
  name.field_1481 = `${multiInstallerIndicator}${name.field_1488}${addressDisplay}<span id="${callout.id}"><span>`.trim() // Calendar display name
  //The event id has been added in a hidden span at the end to identify the tile for popover population

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

// Create parameters required to create / update a google calendar event
async function buildGCalEventBody(callout) {
  let attendees = await getAttendeesV2(callout)
  attendees = attendees.map(attendee => {
    let attendeeObj = {}
    attendeeObj.email = attendee
    return attendeeObj
  })
  return {
    'start': {
      'dateTime': callout.field_924_raw.timestamp,
      'timeZone': moment.tz.guess()
    },
    'end': {
      'dateTime': callout.field_924_raw.to.timestamp,
      'timeZone': moment.tz.guess()
    },
    attendees: attendees,
    'summary': callout.field_1488,
    'location': callout.field_981.replace(/<\/?[^>]+(>|$)/g, ' '), // remove </br> from address string,
    'source': {
      'url': 'https://lovelight.knack.com/tracker#my-call-outs/call-out-details/' + callout.id,
      'title': 'View Details on Tracker'
    },
    'description': `<strong>Jobs(s):</strong> ${callout.field_928.length > 0 ? getConnectionIdentifiers(callout.field_928_raw).join(', ') : undefined} \
                  <strong>Installer(s):</strong> ${callout.field_927.length > 0 ? getConnectionIdentifiers(callout.field_927_raw).join(', ') : undefined} \
                  <strong>Product(s):</strong> ${callout.field_954.length > 0 ? getConnectionIdentifiers(callout.field_954_raw).join(', ') : undefined} \
                  <strong>Instructions:</strong> ${callout.field_929} |${callout.id}`,
  }
}

// Returns a comma separated string of email addresses
async function getAttendees(callout) {
  let attendees = []
  attendees = await getInstallerEmails(callout) // adds array of emails
  attendees.push(await getSalesEmail(callout))
  attendees.push(await getOpsEmail(callout))
  attendees.push(await getOtherAttendeeEmails(callout))
  attendees = attendees.join(',').trim()
  if (attendees.replace(/,/g, ',').length === 0) throw new Error("Can't create event without any attendees")
  return attendees
}

async function getAttendeesV2(callout) {
  let attendees = ['dan@lovelight.com.au']
  // attendees.push(await getInstallerEmails(callout))
  // attendees.push(await getSalesEmail(callout))
  // attendees.push(await getOpsEmail(callout))
  // attendees.push(await getOtherAttendeeEmails(callout))
  //attendees = attendees.join(',').trim()
  //if (attendees.length === 0) throw new Error("Can't create event without any attendees")
  return attendees
}

// Returns a comma separated string of email addresses
async function getInstallerEmails(callout) {
  let installersObj = new KnackObject(objects.installers)
  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await installersObj.find(installerFilter)
  return installers.map(installer => installer.field_870_raw.email)
}

// Checks for inclusion and salesperson opt out
// Returns an email address
// ignorePrefs defaults to false, when true send email even if opted out
async function getSalesEmail(callout, ignorePrefs) {
  if (!callout.field_985_raw || !callout.field_985_raw[0]) return // there is no salesperson on the callout
  if (!ignorePrefs && callout.field_1476.indexOf('Yes') === -1) return '' // we're not emailing them
  let salespeopleObj = new KnackObject(objects.salespeople)
  let salesperson = salespeopleObj.get(callout.field_985_raw[0].id)
  if (!ignorePrefs && salesperson.field_1596 === 'Yes') return '' // they've opted out of event emails
  if (salesperson.field_957_raw) return salesperson.field_957_raw.email
  return undefined
}

// Checks for inclusion and opsperson opt out
// Returns an email address
// ignorePrefs defaults to false, when true send email even if opted out
async function getOpsEmail(callout, ignorePrefs) {
  if (!callout.field_1474_raw || !callout.field_1474_raw[0]) return // there is no ops on the callout
  if (!ignorePrefs && callout.field_1476.indexOf('Yes') === -1) return '' // we're not emailing them
  let opspeopleObj = new KnackObject(objects.opspeople)
  let opsperson = opspeopleObj.get(callout.field_1474_raw[0].id)
  if (!ignorePrefs && opsperson.field_1597 === 'Yes') return '' // they've opted out of event emails
  if (opsperson.field_814_raw) return opsperson.field_814_raw.email
  return undefined
}

// Returns a comma separated string of email addresses
function getOtherAttendeeEmails(callout) {
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
  if (callout.field_1082.length <= 1) return false // if it's not in the calendar, no need to delete
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
  if (callout.field_1082.length <= 1) return false // if it's not in the calendar, no need to udpate
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
  if (installerReportFields.filter(field => changes.includes(field)).length > 0) return true
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

async function handleInstallerReports(callout, previous, changes) {

  //https://sendgrid.com/docs/API_Reference/api_v3.html

  if (!isReportUpdated(changes)) return

  // Get details of person who submitted the report
  let user = Knack.getUserAttributes()
  let installerObj = new KnackObject(objects.installers)
  let installer = await installerObj.get(user.id)

  let isFirstReport = previous.field_1546 === 'Pending'
  let isMutlipleInstallers = callout.field_927_raw.length > 1

  let salesEmail = await getSalesEmail(callout)
  let opsEmail = await getOpsEmail(callout)
  let installerEmail = isMutlipleInstallers ? getInstallerEmails(callout) : [installer.email]

  // Gather data for email.
  let from = {'email':'noreply@lovelight.com.au', 'name':installer.name}
  let reply_to = {'email': installer.email,'name':installer.name}
  let to = [{'email':salesEmail}]
  let cc = [{'email':opsEmail}]
  installerEmail.forEach(installer => cc.push({'email':installer.email}))

  let data = {}
  data.personalizations = []
  data.personalizations.push({})

  let data = {
  "personalizations": [{
    "to": "{{58792153__recipents}}",
	"bcc": [{"email":"mysalesreports@lovelight.com.au"}],
    "dynamic_template_data": {
      "colourRoomName": "{{58790135__field_26}}",
      "dataTableUrl":"{{58872748__url}}",
      "yesterday":"{{58790550__yesterday}}",
      "sevenDaysAgo":"{{58790550__sevenDaysAgo}}"
    }
  }],
  "from": {
    "email": "mysales@lovelight.com.au",
	"name" : "Lovelight"
  },
  "template_id": "d-16efe526579444888d24254026961af1"
}

}

async function sendEmailViaSendGrid(params){
  let url = 'https://api.sendgrid.com/v3/mail/send'
  return fetch(url, params)
}
