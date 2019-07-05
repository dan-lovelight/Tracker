// Remove navigation options from calendar on installers 'Today' page
// https://lovelight.knack.com/tracker#my-call-outs
$(document).on('knack-view-render.view_2057', function(event, view){
  $('.fc-header-right, .fc-header-left').hide()
})

// Format callout details page
$(document).on('knack-scene-render.scene_642', function(event, scene) {
   // Move no issues button into menu
  $('#view_2072, #view_2071').detach().prependTo('#view_2062 .control')

  // Details view below buttons
  $('#view_1442').css({
    "clear": "both",
    "margin-top": "2em"
  })

  // Format button in menu
  $('#view_2071, #view_2072').css({
    "float": "left",
    "margin-right": "0.6em",
    "margin-bottom": "5px"
  })
});
