// Remove navigation options from calendar on installers 'Today' page
// https://lovelight.knack.com/tracker#my-call-outs
$(document).on('knack-view-render.view_2057', function(event, view){
  $('.fc-header-right, .fc-header-left').hide()
})

// Format callout details page
$(document).on('knack-scene-render.scene_642', function(event, scene) {

  // Hide the report form
  $('#view_2074').hide()

  // Get submit report button text
  let buttonTxt = 'Submit Report'
  if(Knack.models.view_1442.attributes.field_1546 && Knack.models.view_1442.attributes.field_1546.indexOf('Submitted')>-1){
    buttonTxt = 'Update Report'
  }

  // Add submit button to menu
  $("#view_2062 > div.control").prepend(`<a class="kn-link kn-button is-primary" id="submit-button"><span class="icon is-small"><i class="fa fa-bullhorn"></i></span><span>${buttonTxt}</span></a>`)

  // Add click listener to button
  $("#submit-button").click(function(){
    // Toggle visibility of report form
    $('#view_2074').toggle()
  })

  // Format button in menu
  $('#view_2062').css({
    "margin-bottom": "2em"
})

});

// Update Report
$(document).on('knack-scene-render.scene_1069', function(event, scene){
  hideEmptyTables(scene)
})

// Format callout details page
$(document).on('knack-scene-render.scene_1055', function(event, scene) {

  function waitForCalendarThenHide() {
    if ($('#view_2243 > div.knack-calendar.fc').length !== 0) {
      $('#view_2243 > div.knack-calendar.fc').hide()
    } else {
      setTimeout(waitForCalendarThenHide, 250);
    }
  }

  waitForCalendarThenHide()

  $("#view_2204 > div.kn-records-nav ul").append('<li id="toggleView"><a><span>Calendar View</span></a></li>')
  $('#view_2243 > div.knack-calendar.fc').hide()
  $('#toggleView').click(function(){
    var $this = $(this)
    $("div.knack-calendar.fc").toggle()
    if($('#view_223 .fc-event').length === 0) {
      $("#view_2243 .fc-button-prev").click()
      $("#view_2243 .fc-button-next").click()
    }
    $this.toggleClass("calendarView")
    if($this.hasClass("calendarView")){
      $this[0].innerHTML = "<a><span>List View</span></a>"

    } else {
      $this[0].innerHTML = "<a><span>Calendar View</span></a>"
    }
  })

});
