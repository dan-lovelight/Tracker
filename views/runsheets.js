// Runsheet today
$(document).on('knack-scene-render.scene_1041', function(event, scene) {
    let today = $('#view_2174 .field_939 span span')[0].innerText
    $('#view_2174').remove()
    let installer = $('#view_2175 .field_869 span span')[0].innerText
    $('#view_2175 .field_869 span span')[0].innerText = installer + ' - ' + today
})

$(document).on('knack-view-render.view_2173', function(event, scene) {
    $('.kn-map-list .kn-list-content').remove()
    $('.kn-map form').remove()
    $('.kn-records-nav').remove()
})

//Runsheet tomorrow
$(document).on('knack-scene-render.scene_1042', function(event, scene) {
    let today = $('#view_2181 .field_939 span span')[0].innerText
    $('#view_2181').remove()
    let installer = $('#view_2180 .field_869 span span')[0].innerText
    $('#view_2180 .field_869 span span')[0].innerText = installer + ' - ' + today

})

$(document).on('knack-view-render.view_2182', function(event, scene) {
    $('#view_2182 .fc-button-next').click()
})

$(document).on('knack-view-render.view_2184', function(event, scene) {
    $('.kn-map-list .kn-list-content').remove()
    $('.kn-map form').remove()
    $('.kn-records-nav').remove()
})
