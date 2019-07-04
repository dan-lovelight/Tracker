// Remove navigation options from calendar on installers 'Today' page
// https://lovelight.knack.com/tracker#my-call-outs
$(document).on('knack-view-render.view_2057', function(event, view){
  $('.fc-header-right, .fc-header-left').hide()
})
