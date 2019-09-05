// Create an array of installer objects from a list view on the page
// That displays all the installers visiblie in the calendar on the page
// Object contains details (name, colour etc) required to build the extra calendar filters
function getInstallerDetailsFromListView(view) {
  let installerList = []
  // Create order form download buttons from files table
  $('#' + view + ' .kn-list-item-container').each((index, tableRow) => {
    let installerDetails = {}
    installerDetails.filterString = buildInstallerFilter(tableRow.id)
    installerDetails.filterTitle = $(tableRow).find('.field_869 .kn-detail-body span span')[0].innerText.split(' ')[0]
    installerDetails.colour = $(tableRow).find('.field_1487 .kn-detail-body div')[0].style['background-color']
    installerList.push(installerDetails)
  })

  installerList.sort((a, b) => {
    var textA = a.filterTitle.toUpperCase();
    var textB = b.filterTitle.toUpperCase();
    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
  })

  return installerList
}

// Build an array of filters with each installers colour applied
// This can then be applied to a calendar dynamically
// Prevents having to manually update calendars for installer colours
// Instead users can manage this themselves
function getInstallerColourFiltersFromListView(view) {

  let eventColours = []

  $('#' + view + ' .kn-list-item-container').each((index, tableRow) => {
    let eventColour = {}
    eventColour.value = tableRow.id
    eventColour.operator = "contains"
    eventColour.color = $(tableRow).find('.field_1487 .kn-detail-body div')[0].style['background-color']
    eventColour.field = "field_927"
    eventColours.push(eventColour)
  })
  return eventColours
}

// Take a single installer and return a filter string for the installer
function buildInstallerFilter(installerId) {
  return filter = {
    "match": "and",
    "rules": [{
      "field": "field_927",
      "operator": "contains",
      "value": installerId,
      "field_name": "Installers"
    }]
  }
}

// Add an extra filter menu to a calendar, based on the data passed in arrFilters
// arrFilters = {
//  'filterTitle': Lable on the filter,
//  'buttonId': #id of filter button,
//  'filterString': a filter string that will be applied to the calendar when clicked,
//  'colour': the background colour of the button }
// view is the view.key (eg 'view_123')
function createFilterMenuNode(arrExtraFilters, view) {

  let menuId = 'extraFilter' // #id of the new menu

  // Check that the meneu doesn't already exist
  if ($('#' + menuId).length > 0) {
    return
  }

  // Create the parent div for the filter
  let filter = document.createElement('div')
  filter.id = menuId
  filter.classList.add('js-filter-menu', 'tabs', 'is-toggle', 'is-flush')
  filter.style = 'display:inline-block; margin-left:10px'

  // Add a list to hold the filter buttons
  let filterList = document.createElement('ul')

  // For each extra filter, add it to the filter list
  arrExtraFilters.forEach(filter => {
    let listItem = document.createElement('li')
    listItem.addEventListener("click", async function() {
      filterView(filter.filterString, view, filter.buttonId) // Apply filter to table when clicked
      //afterCalendarLoad(filter,view)
    });

    let anchor = document.createElement('a')
    let span = document.createElement('span')
    span.innerText = filter.filterTitle
    if (filter.colour === '') {
      anchor.style = `border-color:black;`
      span.style = "color:black"
    } else {
      anchor.style = `border-color:${filter.colour};background-color:${pSBC(0.15, filter.colour)}`
      span.style = "color:white"
    }

    anchor.appendChild(span)
    listItem.appendChild(anchor)
    filterList.appendChild(listItem)
  })

  // Create full menu
  filter.appendChild(filterList)
  return filter
}

//
async function filterView(filterString, view) {
  Knack.models[view].setFilters(JSON.stringify(filterString)) // Turn the filter into a string (in case it's an object)
  //Calling twice is necessary, don't know why
  Knack.models[view].fetch()
  Knack.models[view].fetch()
}

function afterCalendarLoad(filter, view) {
  Knack.showSpinner
  const after = setInterval(async function() {
    let spinner = document.getElementById('kn-loading-spinner')
    let displayStyle = window.getComputedStyle(spinner, null)['display']
    if (displayStyle === 'none') {
      // Execute after function
      clearInterval(after)
      displayInstallerPhone(filter, view)
    }
  })
}

function displayInstallerPhone(filter, view) {
  let phoneDisplay = document.createElement('div')
  phoneDisplay.innerText = filter.filterTitle
  phoneDisplay.id = 'installerPhone'
  phoneDisplay.style = 'display:inline-block; margin-left:10px'
  let $insertLocation = $('#' + view + ' div.kn-records-nav') // selector of the element that the new filter will be placed after
  if ($insertLocation[0]) $insertLocation[0].insertBefore(phoneDisplay, $insertLocation[0].children[1]); // Add menu to page
}

function pimpSchedulingCalendar(view, installerColourKeyList) {
  let installersInCalendar = getInstallerDetailsFromListView(installerColourKeyList) // Get the installer data from the temporary key view
  let eventColours = getInstallerColourFiltersFromListView(installerColourKeyList)
  let newFilter = createFilterMenuNode(installersInCalendar, view) // Build the new filter
  let $insertLocation = $('#' + view + ' div.kn-records-nav') // selector of the element that the new filter will be placed after
  if (newFilter && $insertLocation[0]) $insertLocation[0].insertBefore(newFilter, $insertLocation[0].children[1]); // Add menu to page
  let $menu = $('#' + view + ' div.kn-records-nav div.js-filter-menu')[0]
  if ($menu) $menu.style = 'display:inline-block' // Make menus display next to each other
  $('#' + installerColourKeyList).hide() // Remvoe the temporary key view
  Knack.models[view].view.events.event_colors = eventColours

  // Sometimes duplicate buttons and calendars are added when filtering, don't know why
  if ($('#' + view + ' .fc-header').length > 1) $('#' + view + ' .fc-header')[1].remove()
  if ($('#' + view + ' .fc-content').length > 1) $('#' + view + ' .fc-content')[1].remove()
}

// My calendar
$(document).on('knack-view-render.view_1962', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_1964')
})

// Vic calendar
$(document).on('knack-view-render.view_1347', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_1933')
})

// NSW calendar
$(document).on('knack-view-render.view_2041', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_2043')
})

// QLD calendar
$(document).on('knack-view-render.view_2045', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_2047')
})

// Schedulers requested bookings
$(document).on('knack-scene-render.scene_203', function(event, scene) {
  hideEmptyTables(scene)
})

$(document).on('knack-modal-render.view_1962', function(event, modal) {
  if(modal.modal[0].innerHTML.indexOf('add-event-modal') > -1 ){

    const after = setInterval(async function() {
      let visibleModal = $('.add-event-modal') //document.getElementById('kn-loading-spinner')
      //let displayStyle = window.getComputedStyle(spinner, null)['display']
      if (visibleModal.length > 0) {
        // Execute after function
        clearInterval(after)
        $('#view_2325').clone().prependTo('#cal_entry_view').css('display','block')
        $('#ui-datepicker-div').css('display','none')
        window.selectedTime = {
          fromDate: $('#view_1962-field_924')[0].value,
          fromTime: $('#view_1962-field_924-time')[0].value,
          toTime: $('#view_1962-field_924-time-to')[0].value,
          toDate: $('#view_1962-field_924-to')[0].value,
        }
      }
    })
  }
})

$(document).on('knack-modal-close.view_1962', function(event, modal) {
  window.selectedTime = undefined
})

// Calendar appearance manipulation
$(document).on('knack-view-render.view_1962', function(event, view) {

  waitForAddedNode({
    class: 'fc-event',
    parent: document.querySelector('#view_1962'),
    recursive: true,
    done: processCalendarEvents,
    view: view
  })

  // Hide the requested callouts table
$('#view_2325').css('display','none')
})



function processCalendarEvents(elements, view) {
  colourMultiPersonEvents(elements)
  colourTenativeEvents(elements)
  addPopOvers(elements, view)
}

function colourMultiPersonEvents(elements) {
  for (let event of elements) {
    if (event.innerText.includes('👤👤')) {
      let eventDetails = event.innerHTML
      let searchString = '<span style="background-color:'
      let backgroundColours = []
      while (eventDetails.indexOf(searchString) > 0) {
        let position = eventDetails.indexOf(searchString) + searchString.length
        eventDetails = eventDetails.substring(position)
        backgroundColours.push(eventDetails.substring(0, eventDetails.indexOf('"')))
      }
      let background = 'linear-gradient(145deg'
      let numberOfColours = backgroundColours.length
      let percentColoured = 0
      backgroundColours.forEach(colour => {
        background += `,${colour} ${percentColoured}% ${percentColoured + 100/numberOfColours}%`
        percentColoured = percentColoured + 100 / numberOfColours
      })
      background += ')'
      event.children[0].style.background = background
      event.children[0].children[0].style.background = background
      event.innerHTML = event.innerHTML.replace(/👤/g, '')
    }
  }
}

function colourTenativeEvents(elements) {
  let $eventHeader = $('.fc-event-time').not('is-tentative-styled')
  $eventHeader.each((index, element) => {
    if (element.parentElement.parentElement.innerText.includes('❓')) {
      $(element).addClass("is-tentative-styled");
      $(element).css({
        'background': 'none',
        'background-color': 'red',
        'border-color': 'red'
      })
      $(element.parentElement.parentElement.parentElement).css({
        'background': 'none',
        'background-color': 'red',
        'border-color': 'red'
      })
    }
  })
}

function addPopOvers(elements, view) {
  let $events = $('.fc-event').not('.has-tooltip')
  $events.each((index, element) => {
    $(element).addClass("has-tooltip");
    if ($(element).find('span[id]').length > 0) {
      let eventId = $(element).find('span[id]')[0].id
      let eventDetails = Knack.models[view.key].data.models.find(event => event.attributes.id === eventId).attributes
      let eventName = eventDetails.field_1488
      let startTime = `${eventDetails.field_924_raw.hours}:${eventDetails.field_924_raw.minutes}${eventDetails.field_924_raw.am_pm.toLowerCase()}`
      let endTime = `${eventDetails.field_924_raw.to.hours}:${eventDetails.field_924_raw.to.minutes}${eventDetails.field_924_raw.to.am_pm.toLowerCase()}`
      let installers = eventDetails.field_927
      let suburb = eventDetails.field_981_raw.city
      let tooltipContents = `<div><strong>${eventName}</strong><hr>`
      tooltipContents += `<div><table style="font-size: .9em;" align="center"><tr><td><strong>Start</strong></td><td>${startTime}</td></tr><tr><td><strong>End</strong></td><td>${endTime}</td></tr><tr><td><strong>Suburb</strong></td><td>${suburb}</td></tr><tr><td><strong>Installers</strong></td><td>${installers}</td></tr></table></div></div>`
      let tooltip = new Tooltip(element, {
        placement: 'right',
        title: tooltipContents,//,
        html: true,
      })
    }
  })

  //   for (let event of elements){
  //     let tooltip = new Tooltip(event, {
  //     placement: 'right',
  //     title: "Test"
  // })
  //   }
}

function waitForAddedNode(params) {
  new MutationObserver(function(mutations) {
    var el = document.getElementsByClassName(params.class);
    if (el) {
      //this.disconnect();
      params.done(el, params.view);
    }
  }).observe(params.parent || document, {
    subtree: !!params.recursive,
    childList: true,
  });
}
