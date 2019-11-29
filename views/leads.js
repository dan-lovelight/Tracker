$(document).on('knack-scene-render.scene_1122',function(event, scene){
  loadFieldWithLeadContacts(scene.scene_id, 'view_2424', 'view_1299', 'field_1679')
  loadFieldWithLeadContacts(scene.scene_id, 'view_2428', 'view_1299', 'field_1689')
})

// Lead notes
$(document).on('knack-view-render.view_2424', function(event, view) {
  addSubmitLeadActivityOptions(view)
  pimpContactField(view,'field_1679')
})

function loadFieldWithLeadContacts(leadId, callingViewKey, leadViewKey, field){
  let leads = Knack.views[leadViewKey].model.data.models
  let lead = leads.filter(lead => lead.id === leadId)[0].attributes
  let leadContacts = getContactsFromLead(lead)
  addOptionsToConnectionDropDown(callingViewKey, field, leadContacts)
}

function getContactsFromLead(lead){
  return [{
    id:lead.field_1670_raw[0].id,
    identifier:lead.field_1670_raw[0].identifier
  }]
}

function addOptionsToConnectionDropDown(view_key,field,options){
  let $field = $(`#${view_key}-${field}`)
  let optionHTML = ''
  options.forEach(option=>{
    optionHTML += `<option value="${option.id}">${option.identifier}</option>`
  })
  $field.html(optionHTML).trigger("liszt:updated")
}

// Lead Activities
$(document).on('knack-view-render.view_2428', function(event, view) {

  // Remove cancelled as a status option
  $("#kn-input-field_1688 > div [value=Cancelled]").parent().remove()

  // Add a menu for activity types
  let buttonArray = [{
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

  insertOptionMenu('#view_2424', buttonArray, toggleActivity)

  // set default state
  toggleActivity( window.lastActivity || 'Note')

  function toggleActivity(activitySelected) {

    let $activityType = $(`#${view.key}-field_1685`)
    let activityDetails = buttonArray.filter(activity => activity.return === activitySelected)[0]

    if (activitySelected === 'Note') {
      $('#view_2428').hide()
      $('#view_2424').show()
    } else {
      $('#view_2428').show()
      $('#view_2424').hide()
      // Hide the activity type dropdown
      $('#kn-input-field_1685').hide()
      // Set the activity type in the hidden field
      $activityType.html(`<option value='${activityDetails.optionID}'>${activityDetails.return}</option>`).trigger('liszt:updated')

      //loadFieldWithLeadContacts(view.scene.scene_id, 'view_2428', 'view_1299', 'field_1679')

      // Toggle the date field
      if(activitySelected === "Meeting"){
        $('#kn-input-field_1707').hide()
        $('#kn-input-field_1687').show()
        pimpTimePicker(view, 'field_1687')
      } else{
        $('#kn-input-field_1707').show()
        $('#kn-input-field_1687').hide()
        pimpTimePicker(view, 'field_1707')
      }

    }
  }

  addSubmitLeadActivityOptions(view)
  pimpContactField(view,'field_1689')

})

// Replaces the submit button with two submit options
// One submit as normal, one to submit as dead
function addSubmitLeadActivityOptions(view) {
  // Replace the submit button
  let $submitButton = $(`#${view.key} > form > div`)
  let newButtonHTML = `
<section class="container" style="width:100%">
  <div class="kn-submit" style="display:inline-block">
    <div class="kn-button is-primary alt-submit-${view.key}" type="submit" id="alt-submit">
      ${$submitButton[0].innerText}
    </div>
  </div>
  <div class="kn-submit" style="display:inline-block">
    <div class="kn-button alt-submit-rebook-${view.key}" style="margin-left:5px" type="submit" id="alt-submit-rebook">
      Submit and Rebook
    </div>
  </div>
  <div class="kn-submit" style="display:inline-block">
    <div class="kn-button alt-submit-dead-${view.key}" style="margin-left:5px" type="submit" id="alt-submit-dead">
      Submit as Dead
    </div>
  </div>
  </section>`

  $submitButton.after(newButtonHTML).hide()

  let $submit = $(`.alt-submit-${view.key}`)
  let $submitDead = $(`.alt-submit-dead-${view.key}`)
  let $submitRebook = $(`.alt-submit-rebook-${view.key}`)

  // Call the submit event if normal submit
  $submit.on('click', async function(event) {
    // Need to show the type field or this info is not saved
    $('#kn-input-field_1685').show()
    $submitButton.trigger('submit')

    // Redirect to parent page if submit is successful
    // Let submit begin, then monitor for outcome
    let link = Knack.getPreviousScene().link
    setTimeout(function() {
      let wait = setInterval(function() {
        let isLoading = $('.is-loading').length > 0
        let isError = $('.is-error').length > 0
        if (!isLoading) clearInterval(wait)
        if (!isError) window.location.href = link
      }, 200)
    }, 1000)
  })

  // Call the submit event if normal submit
  $submitRebook.on('click', async function(event) {
    $('#kn-input-field_1685').show()
    $submitButton.trigger('submit')

    // Redirect to parent page if submit is successful
    // Let submit begin, then monitor for outcome
    let link = window.location.href
    setTimeout(function() {
      let wait = setInterval(function() {
        let isLoading = $('.is-loading').length > 0
        let isError = $('.is-error').length > 0
        if (!isLoading) clearInterval(wait)
        if (!isError) {
          // Here we do what needs to be done!

        }
      }, 200)
    }, 1000)

  })

  // Update the lead as dead then call the click event
  $submitDead.on('click', function(event) {
    Knack.showSpinner()

    // Need to show the type field or this info is not saved
    $('#kn-input-field_1685').show()
    $submitButton.trigger('submit')

    // Redirect to parent page if submit is successful
    // Let submit begin, then monitor for outcome
    let link = Knack.getPreviousScene().link
    setTimeout(function() {
      let wait = setInterval(async function() {
        let isLoading = $('.is-loading').length > 0
        let isError = $('.is-error').length > 0
        if (!isLoading) clearInterval(wait)
        if (!isError) {
          let leadsObj = new KnackObject(objects.leads)
          await leadsObj.update(view.scene.scene_id, {
            "field_1705": ['5de043d64546590015b8d4c8']
          })
          window.location.href = link
          // Update the lead as dead
        }
      }, 200)
    }, 1000)

  })

}

// Set this function equal to a global variable called 'wait'
// Will execute the passed in callback after successful submit
function waitForSubmit(callbackAfterSuccess) {
  return setInterval(function() {
    let isLoading = $('.is-loading').length > 0
    if (!isLoading) {
      let isError = $('.is-error').length > 0
      clearInterval(wait)
      if (!isError) {
        callbackAfterSuccess()
      }
    }
  }, 200)
}

// Adds a menu bar at the location indicated by insertBefore paramenter
// Buttons in the menu based on buttonArray:
// [
//  {
//    "display":"buttonText,
//    "return":"value to pass to callback"
//  }
// ]
// onClickFunction takes the return parameter
function insertOptionMenu(insertBefore, buttonArray, onClickCallback) {

  // Don't add the menu twice
  if($('#custom-menu').length>0) return

  // Build the HTML for the menu
  let menu = `
  <div class="kn-records-nav" id='custom-menu' style="margin-bottom:10px">
    <div class="js-filter-menu tabs is-toggle is-flush">
      <ul>
      ${buttonArray.map((button, index) =>{
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
  $('#custom-menu li').click(function() {
    $('#custom-menu .is-active').removeClass("is-active")
    $(this).addClass("is-active")
    window.activitySelected = $(this).attr('data-return')
    onClickCallback(window.activitySelected)
  })

}
