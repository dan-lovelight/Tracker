// Remove navigation options from calendar on installers 'Today' page
// https://lovelight.knack.com/tracker#my-call-outs
$(document).on('knack-scene-render', function(){
  $('.fc-header-right, .fc-header-left').hide()
})
