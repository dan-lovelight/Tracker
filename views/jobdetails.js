$(document).on('knack-scene-render.scene_52', function(event, scene) {

  let hideIfEmpty = [
    'view_2324', // Call out requests
    'view_2088', // Reports
    'view_2323', // Service calls
    'view_958', // Service calls old
    'view_611' // Related jobs
  ]

  hideIfEmpty.forEach(view => {
    if (Knack.models[view] && Knack.models[view].data.length === 0) {
      $('#' + view).remove()
    }
  })

  // collapseTables(scene)
  formatHeading()
  addChangeStatusButtonToMenu()
  addZendeskButtonToMenu('view_2106')
  addOptionsButtonToMenu()

})

function addChangeStatusButtonToMenu() { // Hide the report form
  let changeStatusView = '#view_234'
  let mainMenuView = '#view_2106'


  // Add submit button to menu
  $(mainMenuView + " > div.control").append(`<a class="added-button kn-link kn-button" id="status-toggle"><span class="icon is-small"><i class="fa fa-exchange"></i></span><span>Change Status</span></a>`)

  // Add click listener to button
  $("#status-toggle").click(function() {
    // Toggle visibility of report form
    $(changeStatusView).toggle()
  })

  // Format button in menu
  $(changeStatusView).css({
    "margin-bottom": "2em"
  })

  let notification = `<div class="kn-notification is-warning"><p>For install and measure request, please use the buttons above (which will also update the status)</p></div>`
  $(changeStatusView + '  > form > ul > li').prepend(notification)
  $(changeStatusView).hide()
}

function addZendeskButtonToMenu(viewKey) {
  if ($('.field_1599 a').length > 0) {
    let zdLink = $('.field_1599 a')[0].href
    let mainMenuView = `#${viewKey}`//'#view_2106'
    let button = `<a class="added-button kn-link kn-button" href="${zdLink}" target="_blank"><span><img src="https://s3.us-east-2.amazonaws.com/upload-icon/uploads/icons/png/18487936531552562368-128.png">&nbsp;Zendesk</span></a>`
    $(mainMenuView + " > div.control").append(button)
  }
  $('.field_1599').hide()
}

function formatHeading() {
  let $headerView = $('#view_2339')
  let $jobStatus = $('.job-status-wrapper')
  let $jobTeam = $('#view_1055 div.field_1592 > div > span')
  // Move the status into the heading
  $headerView.find('.kn-detail-body').append($jobStatus)
  $headerView.find('.kn-detail-body').append($jobTeam)
  $jobTeam.addClass('pull-right').attr("id", "job-team")
  // Remove the second table column
  $headerView.find('.kn-details-group > div:nth-child(2)').remove()
  // Move the team field into the heading
}

function addOptionsButtonToMenu() {
  let mainMenuView = '#view_2106'
  let moreOptionsItemsView = '#view_1042'
  let $menuOptions = $(moreOptionsItemsView + ' a')
  let menu = `
    <div class="kn-navigation-bar pull-right" id="jobs-menu">
      <nav class="tabs is-boxed">
        <ul>
          <li class="kn-dropdown-menu">
            <a>
              <span class="icon is-small"><i class="fa fa-gears"></i></span>
              <span>&nbsp;More Options&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span class="kn-dropdown-icon fa fa-caret-down"></span>
            </a>
            <ul class="kn-dropdown-menu-list" style="min-width: 81px;">
            ${$menuOptions.map(function() { return '<li>' + this.outerHTML + '</li>'}).get().join('')}
            </ul>
          </li>
        </ul>
      </nav>
    </div>`
  $(mainMenuView + " > div.control").append(menu)
  $(moreOptionsItemsView).hide()
  //$('#' + viewKey + ' .kn-details-group').append(menu)
}

function collapseTables(scene) {
  // keep track if we've found a table yet
  let firstTable = true
  //Iterate throught each view in the page
  scene.views.map(function(view, index, views) {
    let viewId = '#' + view.key
    // exit if the table doesn't exist (already removed)
    if ($(viewId).length === 0) return
    // If the view has row data (ie it's a table) AND that data is 0...
    if (view.type === 'table' && Knack.models[view.key]) {
      // If first table, add a hide all/none option
      if (firstTable) {
        let toggleAll = `<div class="toggle-tables"><a id="show-all">show all</a> | <a id="hide-all">hide all</a></div>`
        $(viewId).before(toggleAll)
        $('#show-all').on('click', function() {
          $('.fa-chevron-right').addClass('details-visible')
          $('.fa-chevron-right').closest('.view-header').nextAll().slideDown('fast')
        })
        $('#hide-all').on('click', function() {
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
        $(viewId + ' .fa-chevron-right').toggleClass('details-visible')
        $(viewId + ' .view-header').nextAll().slideToggle('fast')
      })

    }
  })
}
