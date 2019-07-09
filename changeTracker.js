class KnackObject {
  constructor(objectKey) {
    this.key = objectKey
    this.knackURL = 'https://api.knackhq.com/v1/'
    this.headers = myKnackHeaders
    if (!window.listeners) {
      window.listeners = {
        [this.key]: {
          create: new Set(),
          update: new Set(),
          delete: new Set(),
        }
      }
    }
  }

  async create(data = {}) {
    let url = this.knackURL + 'objects/' + this.key + '/records/'
    let init = {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    }

    return await this._goFetch(url, init)

  }

  async get(id) {
    let url = this.knackURL + 'objects/' + this.key + '/records/' + id
    let init = {
      method: 'GET',
      headers: this.headers
    }

    return await this._goFetch(url, init)

  }

  async update(id, data = {}) {

    let url = this.knackURL + 'objects/' + this.key + '/records/' + id
    let init = {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data)
    }

    return await this._goFetch(url, init)

  }

  async find(filters = [], sortField = '', sortOrder = '', recordPerPage = 'all') {

    let filtersEnc = encodeURI(JSON.stringify(filters))
    let sortOrderEnc = encodeURI(JSON.stringify(sortOrder))
    let sortFieldEnc = encodeURI(JSON.stringify(sortField))

    let url = this.knackURL + 'objects/' + objectId + '/records?rows_per_page=' + recordPerPage +
      '&filters=' + filtersEnc + "&sort_field=" + sortFieldEnc + "&sort_order=" +
      sortOrderEnc

    let init = {
      method: 'GET',
      headers: this.headers
    }

    return await this._goFetch(url, init)

  }

  onCreate(view, callback) {

    if (view.source === undefined) return
    if (window.listeners[this.key].create.has(view.key)) return
    if (view.action !== 'insert') return
    if (view.source.object !== this.key) return
    window.listeners[this.key].create.add(view.key)

    // Listen for new records
    $(document).on(`knack-record-create.${view.key}`, function(event, view, record) {
      callback(view, record)
    })

  }

  async onUpdate(view, dataBefore, callback) {

    let self = this
    if (view.source === undefined) return
    if (view.source.object !== this.key) return

    // Only add global listeners once
    if (!window.listeners[this.key].update.has(view.key)) {

      // Handle update forms
      if (view.type === 'form' && view.action === 'update') {

        window.listeners[this.key].update.add(view.key)
        let recordBefore = await this.get(view.source.object, dataBefore.id)
        $(document).on(`knack-record-update.${view.key}`, function(event, view, record) {
          compareAndReturn(record, recordBefore)
        })
        return // No action links on forms, exit here

      }

      // Handle tables that allow inline edits
      if (view.type === 'table' && view.options.cell_editor) {

        window.listeners[this.key].update.add(view.key)
        $(document).on(`knack-cell-update.${view.key}`, function(event, view, record) {

          // Identify the original record
          let recordBefore = dataBefore.filter(recordInTable => recordInTable.id === record.id)[0]

          // Build a complete previous record
          Object.keys(record).forEach(key => {
            if (recordBefore[key] === undefined) recordBefore[key] = record[key]
          })

          // Update the original data so our next change has an accurate baseline
          let recordIndex = dataBefore.findIndex(recordInTable => recordInTable.id === record.id)
          dataBefore[recordIndex] = record

          compareAndReturn(record, recordBefore)
        })
      }
    }

    // Handle views with action links (tables & view details)
    let $actionLinks = $('#' + view.key + ' .kn-action-link')
    if ($actionLinks.length > 0) {
      window.listeners[this.key].update.add(view.key)
      // let wait = ms => new Promise((r, j) => setTimeout(r, ms))
      // await wait(100) // Necessary for details forms
      waitForActionLinkEvents()
    }

    function waitForActionLinkEvents() {
      if (typeof $._data($actionLinks[0]).events !== "undefined") {
        interceptActionLinks()
      } else {
        setTimeout(waitForActionLinkEvents, 250);
      }
    }

    async function interceptActionLinks() {
      // Get the listner currently attached to the element
      let clickListener = $._data($actionLinks[0]).events.click[0];
      // Detatch the click event
      $actionLinks.off('click')
      // Replace the click event with our own
      $actionLinks.click(async function(event) {
        let recordId = view.type === 'table' ? $(event.currentTarget).closest('tr').attr('id') : $actionLinks[0].baseURI.split('/').slice(-2).reverse().pop()
        // Execute before function
        let recordBefore = await self.get(recordId)
        // Trigger the original click event
        clickListener.handler(event)
        // Instead, wait for the spinner to disappear before triggering the after function
        const after = setInterval(async function() {
          let spinner = document.getElementById('kn-loading-spinner')
          let displayStyle = window.getComputedStyle(spinner, null)['display']
          if (displayStyle === 'none') {
            // Execute after function
            clearInterval(after)
            let record = await self.get(recordId)
            compareAndReturn(record, recordBefore)
          }
        })
      })
    }

    function compareAndReturn(record, recordBefore) {
      let changes = []

      // Compare before and after
      Object.keys(record).forEach(key => {
        if (recordBefore[key] !== record[key] && key.indexOf('raw') < 0) changes.push(key)
      })

      // Pass to callback if there are changes
      if (changes.length > 0) callback(view, record, recordBefore, changes)
    }

  }

  async onDelete(view, callback) {

    let self = this
    if (view.source === undefined) return
    if (view.source.object !== this.key) return

    // Add our own click listener if there are delete links
    let record
    let $deleteLinks = $('#' + view.key + ' .kn-link-delete')
    if ($deleteLinks.length > 0) {
      if(view.type === 'table') {
        interceptDeleteLinks()
      } else {
        waitForDeleteEvents()
      }
    }

    function waitForDeleteEvents() {
      if (typeof $._data($deleteLinks[0]).events !== "undefined") {
        interceptDeleteLinks()
      } else {
        setTimeout(waitForDeleteEvents, 250);
      }
    }

    function interceptDeleteLinks() {
      $deleteLinks.click(async function(event) {
        let recordId = view.type === 'table' ? $(event.currentTarget).closest('tr').attr('id') : $deleteLinks[0].baseURI.split('/').slice(-2).reverse().pop()
        record = await self.get(recordId)
      })
    }

    // Only add global listeners once
    if (!window.listeners[this.key].delete.has(view.key)) {
      window.listeners[this.key].delete.add(view.key)
      $(document).on(`knack-record-delete.${view.key}`, function(event, view, deletedRecord) {
        waitForRecord()
        function waitForRecord(){
          if (typeof record !== "undefined") {
          callback(view, record)
        } else {
          console.log('had to wait')
          setTimeout(waitForRecord, 250);
        }}
      })
    }
  }

  _assert(cond, message) {
    if (!cond) {
      throw new Error(message)
    }
  }

  async _goFetch(url, init) {
    let response = await fetch(url, init)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  }
}


async function trackChanges(targetObject, originalViewData, view, callback) {
  // Views can be rendered multiple times on a single page. Inline edits is one trigger that causes this.
  // So that we don't add listeners to views multiple times, we to keep track of which views already have listeners
  if (window.viewLoadTracker === undefined) window.viewLoadTracker = {}

  console.log(view.key)
  // Exit if it's not a view we care about
  if (!isViewCapableOfUpdatingTargetObject(targetObject, view)) return

  // To track changes we need to have a snapshot of the original record
  let originalRecord = {}
  // Update forms don't load all fields, need to get full data to catch changes via record rules
  if (view.action === 'update') originalRecord = await getRecordPromise(view.source.object, originalViewData.id)
  // For brand new records there is no original, but knack passes the default values of an empty form
  if (view.action === 'insert') originalRecord = null

  // Array of events that can modify a record and need to be tracked
  let trackedEvents = [
    `knack-record-create.${view.key}`,
    `knack-record-update.${view.key}`,
    `knack-cell-update.${view.key}`,
    `knack-record-delete.${view.key}`
  ]

  // Add event listeners if not already listenting
  if (!viewLoadTracker[view.key]) {
    $(document).on(trackedEvents.join(' '), handler)
    viewLoadTracker[view.key] = true // Flag that this view has already had a lister attached to it - inline edits and forms can be loaded multiple times
  }

  // Add our own click listener if there are action links
  if ($('#' + view.key + ' .kn-action-link').length > 0) {
    insertFunctionBeforeAndAfterClick('#' + view.key + ' .kn-action-link', beforeClick, afterActionClick)
  }

  // Add our own click listener if there are delete links
  let $deleteLinks = $('#' + view.key + ' .kn-link-delete')
  if ($deleteLinks.length > 0) {
    // Get the full record before the record is deleted
    let recordId = $deleteLinks.closest('tr').attr('id')
    $deleteLinks.click(async function() {
      originalRecord = await getRecordPromise(view.source.object, recordId)
    })
  }

  async function beforeClick(recordId) {
    originalRecord = await getRecordPromise(view.source.object, recordId)
    originalViewData = originalRecord // This avoids the following code seeing an array and pulling out the incomplete record
  }

  async function afterActionClick(recordId) {
    updatedRecord = await getRecordPromise(view.source.object, recordId)
    view.action = 'update'
    handler(null, view, updatedRecord)
  }

  // Function that fires after one of the tracked events.
  function handler(event, view, updatedRecord) {

    // The originalViewData object is an array if the trigger event is an inline edit
    let isInlineEdit = isItAnArray(originalViewData)
    let isDelete = event.type === 'knack-record-delete'

    if (isDelete) {
      view.action = 'delete'
      updatedRecord = originalRecord
    } else if (isInlineEdit) {
      // Inline edits happen in tables.
      // The originalRecord is one of the elements of the originalViewData array
      // Need to extract this record
      originalRecord = originalViewData.filter(tableRecord => tableRecord.id === updatedRecord.id)[0]

      // The originalRecord only holds the data that was displayed in the table
      // However, the updated record returned after the edit is the full object
      // There are no record rules to worry about here - can populate the original from the updated
      // This is necessary to avoid getting false change indicators when comparing the two records
      Object.keys(updatedRecord).forEach(key => {
        if (originalRecord[key] === undefined) {
          originalRecord[key] = updatedRecord[key]
        }
      })

      // Views can be edited multiple times without being reloaded
      // In order to capture subsequent changes, need to update the originalViewData
      // For inline edits, this requires updating the target object in the array
      let targetRecordIndex = originalViewData.findIndex(record => record.id === updatedRecord.id)
      originalViewData[targetRecordIndex] = updatedRecord

      // Inline edit views don't have an an action. So we'll set one
      view.action = 'update'
    } else {
      // Other views can also be reloaded multiple times
      originalViewData = updatedRecord
    }

    record = createChangeRecord(originalRecord, updatedRecord)
    record.event = view.action // insert, update
    callback(view, record)
  }

  function createChangeRecord(orginalRecord, updatedRecord) {
    // Copy updated data to a new record
    let record = JSON.parse(JSON.stringify(updatedRecord))

    record.updatedFields = []
    record.previous = {}
    // Create a full set of previous records on the record
    // Loop through the updatedRecord and for each key, assign the record.previous value to the orginalRecord value
    Object.keys(updatedRecord).forEach(key => {
      // If there is a previous record, populate the previous property with value
      if (originalRecord) {
        if (originalRecord[key] !== undefined) {
          record.previous[key] = orginalRecord[key]
        } else {
          record.previous[key] = ''
        }
      } else {
        record.previous[key] = ''
      }
      // If the field has changed, add the field name to change tracking array
      if (record[key] !== record.previous[key] && key.indexOf('raw') < 0) {
        record.updatedFields.push(key)
      }
    })
    // Flag if anything has changed
    record.isChanged = record.updatedFields.length > 0 ? true : false

    return record
  }
}

function insertFunctionBeforeAndAfterClick(selector, beforeFunc, afterFunc) {
  // Get the target element
  let $targetElement = $(selector)
  let recordId = $targetElement.closest('tr').attr('id')
  // For details forms we need to wait for the DOM to finish loading
  $(window).on('load', function() {
    // Get the listner currently attached to the element
    let clickListener = $._data($targetElement[0]).events.click[0];
    // Detatch the click event
    $targetElement.off('click')
    // Replace the click event with our own
    $targetElement.click(async function(event) {
      // Execute before function
      beforeFunc(recordId)
      // Trigger the original click event
      clickListener.handler(event)
      // Unfortunately the action link handler does not return a promise
      // Instead, wait for the spinner to disappear before triggering the after function
      const after = setInterval(function() {
        let spinner = document.getElementById('kn-loading-spinner')
        let displayStyle = window.getComputedStyle(spinner, null)['display']
        if (displayStyle === 'none') {
          // Execute after function
          afterFunc(recordId)
          clearInterval(after)
        }
      })
    })
  })
}

function isViewCapableOfUpdatingTargetObject(targetObject, view) {
  // Is it a view without a source?
  if (view.source === undefined) return false
  // Is it a 'pseudo' celleditor view?
  if (view.key.indexOf('_celleditor') > 0) return false
  // Is it displaying the targetObject?
  if (view.source.object !== targetObject) return false
  // Exit if a table, no inline editing, no action links, no delete link
  if (view.type === 'table') {
    let isInlineEdit = view.options.cell_editor
    let isActionLink = $('#' + view.key + ' .kn-action-link').length > 0
    let isDeleteLink = $('#' + view.key + ' .kn-deleted-link').length > 0
    if (!(isInlineEdit || isActionLink || isDeleteLink)) return false
  }
  return true
}
