$(document).on('knack-scene-render.scene_52', function(event, scene) {

  let hideIfEmpty = [
    'view_2324', // Call out requests
    'view_2088', // Reports
    'view_2323', // Service calls
    'view_958', // Service calls old
    'view_611' // Related jobs
  ]

  hideIfEmpty.forEach(view => {
    if (Knack.models[view].data.length === 0) {
      $('#' + view).remove()
    }
  })

  collapseTables(scene)

})

function collapseTables(scene) {
  // keep track if we've found a table yet
  let firstTable = true
  //Iterate throught each view in the page
  scene.views.map(function(view, index, views) {
    let viewId = '#' + view.key
    // exit if the table doesn't exist (already removed)
    if($(viewId).length===0) return
    // If the view has row data (ie it's a table) AND that data is 0...
    if (view.type === 'table' && Knack.models[view.key]) {
      // If first table, add a hide all/none option
      if(firstTable){
        let toggleAll = `<div class="toggle-tables"><a id="show-all">show all</a> | <a id="hide-all">hide all</a></div>`
        $(viewId).before(toggleAll)
        $('#show-all').on('click',function(){
            $('.fa-chevron-right').addClass('details-visible')
            $('.fa-chevron-right').closest('.view-header').nextAll().slideDown('fast')
        })
        $('#hide-all').on('click',function(){
            $('.fa-chevron-right').removeClass('details-visible')
            $('.fa-chevron-right').closest('.view-header').nextAll().slideUp('fast')
        })
        firstTable = false
      }
      // For each table, look for forms and menues below them and move into the table
      for (let i = index + 1; i < views.length - 1; i++) {
        let viewType = views[i].type
        if (viewType === 'table') break
        if (viewType === 'menu' || viewType === 'form') {
          let associatedView = $('#' + views[i].key)
          $(viewId).append(associatedView)
        }
      }

      // Add the chevron to the table title
      let tableTitle = $('#' + view.key + ' .kn-title')[0].innerText
      $(viewId + ' .kn-title')[0].innerHTML = '<i class="fa fa-chevron-right"></i>' + tableTitle

      // Hide the table contents
      $(viewId + ' .view-header').nextAll().toggle()

      // Add listner to show it again
      $(viewId + ' .fa-chevron-right').parent().on('click', function() {
        $(this).toggleClass('details-visible')
        $(viewId + ' .view-header').nextAll().slideToggle('fast')
      })

    }
  })
}
