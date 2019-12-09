

$(document).on('knack-scene-render.scene_1122 knack-view-render.view_2428 knack-view-render.view_2424', function(event, sceneOrView) {

  // Add activity option menu
  let activityOptions = [{
    display: '📄 Note',
    return: "Note"
  }, {
    display: '📞 Call',
    return: "Call",
    optionID: "5dde09f0b19ce90016428186"
  }, {
    display: '🤝 Meeting',
    return: "Meeting",
    optionID: "5dde0a04225c5f00151ee8f4"
  }, {
    display: '📧 Email',
    return: "Email",
    optionID: "5dde09fb8f1b080015f60d47"
  }, {
    display: '✅ Task',
    return: "Task",
    optionID: "5dde09f4b5d12c00185236fa"
  }, ]

  // New submit buttons
  let newSubmitButtons = [{
      "name": "Submit",
      "primary": true,
      "callbackBefore": showLeadActivityOptionsDropdown,
      "callbackBeforeArgs" : [activityOptions],
      "submit": true,
      "callbackAfter": redirectToParentPage
    },
    {
      "name": "Submit and Rebook",
      "primary": false,
      "callbackBefore": showLeadActivityOptionsDropdown,
      "callbackBeforeArgs" : [activityOptions],
      "submit": true,
      "callbackAfter": false
    },
    {
      "name": "Submit as Dead",
      "primary": false,
      "callbackBefore": showLeadActivityOptionsDropdown,
      "callbackBeforeArgs" : [],
      "submit": true,
      "callbackAfter": markTargetLeadAsDeadAndRedirectToParent
    }
  ]

  // Get all views, approach varies if called by scene or view
  let allViews = sceneOrView.views || sceneOrView.scene.views
  let leadId = sceneOrView.scene_id || sceneOrView.scene.scene_id

  // Add the activity options menu if it doesn't already exist.
  let $activityOptionsMenu = $('#activityOptionsMenu')
  if($activityOptionsMenu.length === 0) insertOptionMenu('#view_2424', activityOptions, toggleActivity, 'activityOptionsMenu')

  // If required, swap out submit buttons on add note view
  let notesView = allViews.filter(view => view.key === 'view_2424')[0]
  let $notesSubmitButtons = $('#altSubmitNote')
  if($notesSubmitButtons.length === 0 ) replaceSubmitButton(notesView, newSubmitButtons, 'altSubmitNote')

  // If required, swap out submit buttons on add activity view
  let activitiesView = allViews.filter(view => view.key === 'view_2428')[0]
  let $activitiesSubmitButtons = $('#altSubmitActivities')
  if($activitiesSubmitButtons.length=== 0 ) replaceSubmitButton(activitiesView, newSubmitButtons, 'altSubmitActivities')

  // Format scene display
  pimpContactField(activitiesView, 'field_1679')
  pimpContactField(notesView, 'field_1679')
  $("#kn-input-field_1688 > div [value=Cancelled]").parent().remove() // Remove cancelled as a status option
  toggleActivity(window.activitySelected || 'Note')
  $('#kn-input-field_1688 > div, #kn-input-field_1711 > div').on('click',function(){
    applyActivityDisplayRules()
  })

  // Add listener for when notes contact field is clicked
  $('#view_2424_field_1679_chzn input').on('click', function() {
    // Check if it has already been populated
    if ($('#view_2424-field_1679 option').length === 0) {
      // If not, populate the note contacts dropdown with Lead contacts
      loadFieldWithLeadContacts(leadId, 'view_2424', 'view_1299', 'field_1679')
    }
  })

  // Add listnerer for when activites contact field is clicked
  $('#view_2428_field_1689_chzn input').on('click', function() {
    // Check if it has already been populated
    if ($('#view_2428-field_1689 option').length === 0) {
      // If not, populate the activities contacts dropdown with Lead contacts
      loadFieldWithLeadContacts(leadId, 'view_2428', 'view_1299', 'field_1689')
    }
  })

})

// Notes required
function toggleActivity(activitySelected) {

  let notesViewKey = 'view_2424'
  let $notesView = $(`#${notesViewKey}`)

  let activitiesViewKey = 'view_2428'
  let $activitiesView = $(`#${activitiesViewKey}`)

  // Set global variable to keep track of last option selected
  window.activitySelected = activitySelected

  if (activitySelected === 'Note') {
    $activitiesView.hide()
    $notesView.show()
  } else {
    $activitiesView.show()
    $notesView.hide()
    applyActivityDisplayRules()
    // Hide the activity type dropdown
    $('#kn-input-field_1685').hide()

    // Toggle the date field
    if (activitySelected === "Meeting") {
      $('#kn-input-field_1707').hide()
      $('#kn-input-field_1687').show()
      pimpTimePicker({key:activitiesViewKey}, 'field_1687')
    } else {
      $('#kn-input-field_1707').show()
      $('#kn-input-field_1687').hide()
      pimpTimePicker({key:activitiesViewKey}, 'field_1707')
    }

  }
}

function applyActivityDisplayRules(){
  let activity = window.activitySelected
  let isComplete = $('input[name=view_2428-field_1688]:checked').val() === 'Complete'
  let isSuccess = $('input[name=view_2428-field_1711]:checked').val() === 'Success'

  // Show call outcomes if a call
  if(isComplete && activity === 'Call'){
    $('#kn-input-field_1711').show()

    // Hide details unless successful
    if(isSuccess){
      $('#kn-input-field_1691').show()
    } else {
      $('#kn-input-field_1691').hide()
    }

  } else {
    // Hide call outcomes
    $('#kn-input-field_1711').hide()
  }
}

// ***********************
// Functions for new buttons
function showLeadActivityOptionsDropdown(activityOptions) {

    // Set the activity type in the hidden field
    $('#kn-input-field_1685').show()
    let $activityType = $(`#view_2428-field_1685`)
    let activityDetails = activityOptions.filter(activity => activity.return === activitySelected)[0]
    $activityType.html(`<option value='${activityDetails.optionID}'>${activityDetails.return}</option>`).trigger('liszt:updated')
    if ($activityType[0].value === '' || $activityType[0].value === undefined) throw new Error('activity type not set')
}

async function markTargetLeadAsDeadAndRedirectToParent() {
  let leadsObj = new KnackObject(objects.leads)
  await leadsObj.update(Knack.hash_id, {
    "field_1705": ['5de043d64546590015b8d4c8']
  })
  window.location.href = Knack.getPreviousScene().link
}

function loadFieldWithLeadContacts(leadId, callingViewKey, leadViewKey, field) {
  let leads = Knack.views[leadViewKey].model.data.models
  let lead = leads.filter(lead => lead.id === leadId)[0].attributes
  let leadContacts = getContactsFromLead(lead)
  if (leadContacts) addOptionsToConnectionDropDown(callingViewKey, field, leadContacts)
}

function getContactsFromLead(lead) {
  if (!lead.field_1670_raw || lead.field_1670_raw.length === 0) return
  return [{
    id: lead.field_1670_raw[0].id,
    identifier: lead.field_1670_raw[0].identifier
  }]
}

// **************
// Utils
function redirectToParentPage() {
  if(Knack.getPreviousScene().link !=='#') window.location.href = Knack.getPreviousScene().link
}

function addOptionsToConnectionDropDown(view_key, field, options) {
  let $field = $(`#${view_key}-${field}`)
  let optionHTML = ''
  options.forEach(option => {
    optionHTML += `<option value="${option.id}">${option.identifier}</option>`
  })
  $field.html(optionHTML).trigger("liszt:updated")
}

// Takes an array of button objects
// Replaces the standard submit button with buttons defined in this array
// [{
//  name: name,
//  primary: boolean - should the button have the 'is-prmary' class
//  callbackBefore: callback function to execute before submit, will await if async. Always executed, even if submit fails.
//  callbackBeforeArgs : array of arguements to pass to the callback
//  submit: boolean - should submit be called after callback function?
//  callbackAfter: callback function to execute after, will await if async
// callbackAfterArgs : array of arguements to pass to the callback
// }]
function replaceSubmitButton(view, arrayOfButtons, buttonGroupId) {

  // Get the current submit button// Replace the submit button
  let $submitButton = $(`#${view.key} > form > div`)

  // Build HTML for replacement button(s)
  let newButtonHTML = `
<section class="container" id="${buttonGroupId ? buttonGroupId : ''}" style="width:100%">
  ${arrayOfButtons.map((button, index) =>{
    return `<div class="kn-submit" style="display:inline-block">
      <div class="kn-button ${button.primary? 'is-primary' : ''} alt-submit-${index}" style="${index>0 ? 'margin-left:5px': ''}" type="submit" id="alt-submit-${view.key}-${index}">
        ${button.name}
      </div>
    </div>`
  }).join('')}
  </section>`

  // Swap out the submit buttons in the DOM
  $submitButton.after(newButtonHTML).hide()

  // Apply the callback to the click event for each button
  arrayOfButtons.forEach((button, index) => {

    // Get the newly added button
    let $newButton = $(`#alt-submit-${view.key}-${index}`)

    // Add click listner
    $newButton.on('click', async function(event) {
      // Execute before submit callback
      if (button.callbackBefore) {
        await button.callbackBefore(...button.callbackBeforeArgs || undefined)
      }

      // Submit the form
      if (button.submit) {
        $submitButton.trigger('submit')
      }

      // Execute the after callback
      if (button.callbackAfter) {
        // Wait to ensure the submit has worked
        setTimeout(function() {
          let wait = setInterval(async function() {
            let isLoading = $('.is-loading').length > 0
            let isError = $('.is-error').length > 0
            if (!isLoading) clearInterval(wait)
            if (!isError) {
              await button.callbackAfter(...button.callbackAfterArgs || undefined)
            }
          }, 200)
        }, 1000)
      }

    })

  })

}

// Adds a menu bar at the location indicated by insertBefore paramenter
// Buttons in the menu based on optionsArray:
// [
//  {
//    "display":"buttonText,
//    "return":"value to pass to callback"
//  }
// ]
// onClickFunction takes the return parameter
// function returns the 'return' value specificed in the options array
function insertOptionMenu(insertBefore, optionsArray, onClickCallback, buttonGroupId="custom-menu") {

  // Don't add the menu twice
  if ($(`#${buttonGroupId}`).length > 0) return

  // Build the HTML for the menu
  let menu = `
  <div class="kn-records-nav" id="${buttonGroupId}" style="margin-bottom:10px">
    <div class="js-filter-menu tabs is-toggle is-flush">
      <ul>
      ${optionsArray.map((button, index) =>{
        let buttonHTML = `<li id="customButton${index}" data-return="${button.return}"`
        if(index===0) buttonHTML += `class="is-active"`
        buttonHTML += `><a><span>${button.display}</span></a></li>`
        return buttonHTML
      }).join('')}
      </ul>
    </div>
  `
  // Add menu to view
  $(menu).insertBefore(insertBefore)

  // Add listeners
  $(`#${buttonGroupId} li`).click(function() {
    $(`#${buttonGroupId} .is-active`).removeClass("is-active")
    $(this).addClass("is-active")
    let returnValue = $(this).attr('data-return')
    onClickCallback(returnValue, optionsArray)
  })

}
