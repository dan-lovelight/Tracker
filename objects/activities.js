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

    handleActivityNotes(activity, action.isCreate, view, previous, changes)
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

function isDateUpdated(changes) {
  if (changes.includes('field_1708')) return true
  return false
}

function handleActivityNotes(activity, isNewActivity, view, previous, changes) {
  try {

    let type = activity.field_1685_raw[0].identifier
    let user = Knack.getUserAttributes()
    let isStatusUpdated = isActivityStatusUpdated(changes)
    let isDateUpdated = isDateUpdated(changes)
    let status = activity.field_1688
    let isCreated = isNewActivity
    let date = type === 'Meeting' ? activity.field_1708_raw.date_formatted : activity.field_1687_raw.date_formatted
    let time = type === 'Meeting' ? `${activity.field_1708_raw.hours}:${activity.field_1708_raw.minutes.length===1 ? '0':''}${activity.field_1708_raw.minutes}${activity.field_1708_raw.am_pm}` : ''
    let contactNames = getConnectionIdentifiers(activity.field_1689_raw).reduce((names,name, index)=>{
      if(index === 0){
        names += name
      } else if(index === activity.field_1689_raw.length-1){
        names += ` and ${name}`
      } else {
        names += `, ${name}`
      }
      return names
    },'')
    let notes = []
    let data = {}

    let noteType
    if(isCreated || isStatusUpdated){
      noteType = status // If the activity is just created, or the status has been changed, then the note required is determined by the new status
    } else if(isDateUpdated){
      noteType = 'Rescheduled'
    } else {
      return
    }

    data.field_1655 = user.name // Create by
    data.field_1684 = [activity.id]
    data.field_1679 = getConnectionIDs(activity.field_1689_raw) // contact ids
    data.field_1692 = getConnectionIDs(activity.field_1690_raw) // lead ids
    data.field_579 = [] // job ids
    data.field_1663 = [] // opportunity ids
    data.field_1680 = [] // company ids

    switch (type) {

      case 'Email': {

        if(noteType === 'Scheduled'){
          data.field_1659 = ['5de040c84546590015b8d2f5'] // note type
          data.field_576 = `Email ${activity.field_1689.length > 0 ? `to ${contactNames} ` : ''}scheduled for ${date}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Complete'){
          data.field_1659 = ['5de0411bfaf6780015e6db8e'] // note type
          data.field_576 = `Email ${activity.field_1689.length > 0 ? `to ${contactNames} ` : ''}logged: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Cancelled'){
          data.field_1659 = ['5dedcddc81313500159dd367'] // note type
          data.field_576 = `Email ${activity.field_1689.length > 0 ? `to ${contactNames} ` : ''}cancelled: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Rescheduled'){
          data.field_1659 = ['5e5ca878fbc9650019b47a73'] // note type
          data.field_576 = `Email ${activity.field_1689.length > 0 ? `to ${contactNames} ` : ''}rescheduled for ${date}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
      break
      }

      case 'Call': {

        let callOutcome = activity.field_1711

        if(noteType === 'Scheduled'){
          data.field_1659 = ['5de03fc9b646f10015abf9e1'] // note type
          data.field_576 = `Call ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}scheduled for ${date}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Complete' && callOutcome === 'Connected'){
          data.field_1659 = ['5de0401cfaf6780015e6dab7'] // note type
          data.field_576 = `Call ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}logged: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Complete' && callOutcome === 'No Answer'){
          data.field_1659 = ['5de0403ada511100150e06e3'] // note type
          data.field_576 = `Call ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}logged: No answer`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Complete' && callOutcome === 'Left Voicemail'){
          data.field_1659 = ['5de03ffb11d759001575f2d7'] // note type
          data.field_576 = `Call ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}logged: Left voicemail`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Cancelled'){
          data.field_1659 = ['5dedce0270794b0015ee8781'] // note type
          data.field_576 = `Call ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}cancelled: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Rescheduled'){
          data.field_1659 = ['5e5ca8b5ab5546001600c521'] // note type
          data.field_576 = `Call ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}rescheduled for ${date}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
      break
      }

      case 'Meeting': {

        if(noteType === 'Scheduled'){
          data.field_1659 = ['5de0414e6ca77100154b7925'] // note type
          data.field_576 = `Meeting ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}scheduled for ${date} at ${time}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Complete'){
          data.field_1659 = ['5de04162faf6780015e6dbaf'] // note type
          data.field_576 = `Meeting ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}logged: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Cancelled'){
          data.field_1659 = ['5dedce47df15170015bc96f2'] // note type
          data.field_576 = `Meeting ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}cancelled: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Rescheduled'){
          data.field_1659 = ['5e5ca8f064ce240016b9447a'] // note type
          data.field_576 = `Meeting ${activity.field_1689.length > 0 ? `with ${contactNames} ` : ''}rescheduled for ${date} at ${time}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
      break
      }

      case 'Task':{

        if(noteType === 'Scheduled'){
          data.field_1659 = ['5de04075a297fc00150edf1c'] // note type
          data.field_576 = `Task scheduled for ${date}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Complete'){
          data.field_1659 = ['5de0407e4546590015b8d2c0'] // note type
          data.field_576 = `Task complete: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Cancelled'){
          data.field_1659 = ['5dedcec410f0b80016b9f5d9'] // note type
          data.field_576 = `Task cancelled: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
        if(noteType === 'Rescheduled'){
          data.field_1659 = ['5e5ca92e64ce240016b944b7'] // note type
          data.field_576 = `Task rescheduled for ${date}: ${activity.field_1691}`
          notes.push(JSON.parse(JSON.stringify(data)))
        }
      break
      }
    }

    // Insert the notes if there are any
    if (notes.length > 0) addActivityRecords(notes)
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}
