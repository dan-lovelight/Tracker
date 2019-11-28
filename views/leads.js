// Lead notes
$(document).on('knack-view-render.view_2424', function(event, view) {
  addSubmitLeadActivityOptions(view)
})

// Lead Activities
$(document).on('knack-view-render.view_2428', function(event, view) {
  // Hide the activity view. Notes shows by default first
  $(`#${view.key}`).hide

  // Remove cancelled as a status option
  $("#kn-input-field_1688 > div [value=Cancelled]").parent().remove()

  // Add a menu for activity types
  let buttonArray = [{
    display: '📄 Note',
    return: "Note"
  }, {
    display: '📞 Call',
    return: "Call",
    optionID:"5dde09f0b19ce90016428186"
  }, {
    display: '🤝 Meeting',
    return: "Meeting",
    optionID:"5dde0a04225c5f00151ee8f4"
  }, {
    display: '📧 Email',
    return: "Email",
    optionID:"5dde09fb8f1b080015f60d47"
  }, {
    display: '✅ Task',
    return: "Task",
    optionID:"5dde09f4b5d12c00185236fa"
  }, ]

  insertOptionMenu('#view_2424', buttonArray, toggleActivity)

  // set default state
  toggleActivity('Note')

  function toggleActivity(activitySelected) {

    let $activityType = $(`#${view.key}-field_1685`)
    let activityDetails = buttonArray.filter(activity => activity.return===activitySelected)[0]

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
    }
  }

  addSubmitLeadActivityOptions(view)

})

// Replaces the submit button with two submit options
// One submit as normal, one to submit as dead
function addSubmitLeadActivityOptions(view) {
  // Replace the submit button
  let $submitButton = $(`#${view.key} > form > div`)
  let newButtonHTML = `
<section class="container" style="width:100%">
  <div class="kn-submit" style="float:left">
    <div class="kn-button is-primary" type="submit" id="new-submit">
      ${$submitButton[0].innerText}
    </div>
  </div>
  <div class="kn-submit">
    <div class="kn-button" style="margin-left:5px" type="submit" id="new-submit-dead">
      Submit as Dead
    </div>
  </div>
  </section>`

  $submitButton.after(newButtonHTML).hide()

  let $submit = $('#new-submit')
  let $submitDead = $('#new-submit-dead')

  // Call the submit event if normal submit
  $submit.on('click', async function(event) {
    $('#kn-input-field_1685').show()
    $submitButton.trigger('submit')
  })

  // Update the lead as dead then call the click event
  $submitDead.on('click', async function(event) {
    Knack.showSpinner()
    let leadsObj = new KnackObject(objects.leads)
    await leadsObj.update(view.scene.scene_id, {
      "field_973": "Dead"
    })
    $('#kn-input-field_1685').show()
    $submitButton.trigger('submit')
  })

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

  // Build the HTML for the menu
  let menu = `
  <div class="kn-records-nav" id='custom-menu'>
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
    onClickCallback($(this).attr('data-return'))
  })

}
