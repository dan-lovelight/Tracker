function processActivityChange({record:activity, changes, action, view, previous}) {
  try {

    let statusUpdates = getActivityStatusChangeDetails(changes)
    let newRecord = action.isCreate ? {'field_1696':Knack.getUserAttributes().name } : {}

    // Consolidate the data
    let updateData = Object.assign({}, statusUpdates, newRecord)

    // Update the activity
    if (!$.isEmptyObject(updateData)) {
      let activityObj = new KnackObject(objects.activities)
      activityObj.update(activity.id, updateData)
    }

    //handleActivityNotes(activity, action.isCreate, view, previous, changes)
    //handleSlackNotifications(opportunity, changes, previous, action)

  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }
}

function getActivityStatusChangeDetails(changes){
  let data = {}
  let isStatusUpdated = isActivityStatusUpdated(changes)

  if (isStatusUpdated) {
    data.field_1714 = {
      "date": moment().format("DD/MM/YYYY"),
    }
  }
  return data
}

function isActivityStatusUpdated(changes) {
  if (changes.includes('field_1688')) return true
  return false
}

function handleActivityNotes(activity, isNewActivity, view, previous, changes) {
  try {

    let activityTypes = {
      'Email':'5dde09fb8f1b080015f60d47',
      'Meeting':'5dde0a04225c5f00151ee8f4',
      'Call':'5dde09f4b5d12c00185236fa',
      'Task':'5dde09f0b19ce90016428186'
    }

    let type = Object.entries()
    let user = Knack.getUserAttributes()
    let isStatusUpdated = isActivityStatusUpdated(changes)
    let notes = []
    let data = {}



    data.field_1655 = user.name // Create by
    data.field_1684 = [activity.id]

    if (isNewActivity) {
      // Insert activity created record
      data.field_1659 = ['5d8c093bfc02f50011364c1e'] // Activity Created
      data.field_576 = `Activity created from ${view.name} form`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isThereANote) {
      // Insert a note record
      data.field_1659 = ['5d8c078bdb00f0001095e39d'] // Note
      data.field_576 = activity.field_1652 // Note details
      notes.push(JSON.parse(JSON.stringify(data)))
      clearTempActivityNote(activity)
    }

    if (isStatusUpdated) {
      let status = activity.field_245
      if (status.indexOf('Complete') > -1) {
        // Insert a activity completed record
        data.field_1659 = ['5d9435e24dbdf0001041faec'] // Activity Completed
        data.field_576 = `Status changed from ${previous.field_245_raw[0].identifier.split(' - ')[1]} to ${activity.field_245_raw[0].identifier.split(' - ')[1]}`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else if (status.indexOf('Cancelled') > -1) {
        // Insert a activity cancelled record
        data.field_1659 = ['5d94360307205f001028211c'] // Activity Cancelled
        data.field_576 = `Status changed from ${previous.field_245_raw[0].identifier.split(' - ')[1]} to ${activity.field_245_raw[0].identifier.split(' - ')[1]}`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else {
        // Insert a status change record
        data.field_1659 = ['5d8c0d5622d07d0010b41b9e'] // Status Change
        data.field_576 = `Status changed from ${previous.field_245_raw[0].identifier.split(' - ')[1]} to ${activity.field_245_raw[0].identifier.split(' - ')[1]}`
        notes.push(JSON.parse(JSON.stringify(data)))
      }
    }

    // Insert the notes if there are any
    if (notes.length > 0) addActivityRecords(notes)
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}
