// Knack object has two sets of methods:
//
// 1) For manipulating records
// .create(data)
// .get(id)
// .update(id, data)
// .find(filters, [sortField], [sortOrder], [recordPerPage])
//
// 2) For capturing changes
// .onCreate(view, callback)
// .onUpdate(view, callback)
// .onDelete(view, callback)
// All three of these functions return 5 arguements to the callback:
// callback(view, record, user, previousRecord, changes)

class KnackObject {
  constructor(objectKey) {
    this.key = objectKey
    this.knackURL = 'https://api.knackhq.com/v1/'
    this.headers = myKnackHeaders
    this.user = Knack.getUserAttributes()

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

    let self = this
    if (view.source === undefined) return
    if (window.listeners[this.key].create.has(view.key)) return
    if (view.action !== 'insert') return
    if (view.source.object !== this.key) return
    window.listeners[this.key].create.add(view.key)

    // Listen for new records
    $(document).on(`knack-record-create.${view.key}`, function(event, view, record) {
      callback(view, record, self.user, {}, [])
    })

  }

  async onUpdate(view, callback) {

    let self = this
    if (view.source === undefined) return
    if (view.source.object !== this.key) return
    let recordBefore = {}

      // Handle update forms
      if (view.type === 'form' && view.action === 'update') {
        recordBefore = await this.get(view.scene.scene_id)
        // Only add global listeners once
        if (!window.listeners[this.key].update.has(view.key)) {
        window.listeners[this.key].update.add(view.key)
        $(document).on(`knack-record-update.${view.key}`, recordUpdateHandler)
        return // No action links on forms, exit here
      }
      }

      // Handle tables that allow inline edits
      if (view.type === 'table' && view.options.cell_editor) {
        // This needs to be a global variable - knack listeners are only added once, but the data can change after sorting, paging etc
        window.dataBefore = JSON.parse(JSON.stringify(Knack.views[view.key].model.data.models))
        // Only add global listeners once
        if (!window.listeners[this.key].update.has(view.key)) {
        window.listeners[this.key].update.add(view.key)
        $(document).on(`knack-cell-update.${view.key}`, cellUpdateHandler)
      }
      }

    function recordUpdateHandler(event, view, record){
      compareAndReturn(record, recordBefore)
      // Reset the baseline
      recordBefore = record
    }

    function cellUpdateHandler(event, view, record){
      // Identify the original record
      recordBefore = dataBefore.filter(recordInTable => recordInTable.id === record.id)[0]

      // Build a complete previous record
      Object.keys(record).forEach(key => {
        if (recordBefore[key] === undefined) recordBefore[key] = record[key]
      })

      // Just in case the view doesn't re-render, need to update our baseline data
      window.dataBefore = JSON.parse(JSON.stringify(Knack.views[view.key].model.data.models))

      compareAndReturn(record, recordBefore)
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
      if (changes.length > 0) callback(view, record, self.user, recordBefore, changes)
    }

  }

  async onDelete(view, callback) {

    let self = this
    if (view.source === undefined) return
    if (view.source.object !== this.key) return
    let record

    // Add our own click listener if there are delete links
    let $deleteLinks = $('#' + view.key + ' .kn-link-delete')
    if ($deleteLinks.length > 0) {
      if (view.type === 'table') {
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
        record = false

        // Only add global listeners once
        if (!window.listeners[self.key].delete.has(view.key)) {
          window.listeners[self.key].delete.add(view.key)
          $(document).on(`knack-record-delete.${view.key}`, function() {
            waitForRecord()
          })
        }
        record = await self.get(recordId)
      })

      function waitForRecord() {
        if (record) {
          callback(view, record, self.user, {}, [])
        } else {
          console.log('had to wait')
          setTimeout(waitForRecord, 250);
        }
      }

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
