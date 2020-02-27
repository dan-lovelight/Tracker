// https://lovelight.knack.com/tracker#custom-opportunities/view-opportunity-details/{}/upload-test/{}/
// modal for uploading file that is sent to Pandadoc to create quote
$(document).on('knack-scene-render.scene_1108', function(event, scene) {
  // Swap out action buttons
  $('#view_2422 .kn-submit').after('<a class="kn-button is-primary" id="load-file">Load File</a>')
  $('.kn-submit')[0].remove()

  // Process the file when button is clicked
  $('#load-file').click(function() {

    // Use the uploaded cat csv file and the opportunity id to generate a quote in pandadocs
    generateQuote('field_1673_upload', scene.scene_id)

  })

})

$(document).on('knack-scene-render.scene_414', function(event, scene) {

  $('#view_1659').after('<div id="pandadoc-list" class="pandadoc"></div>')

  var doclist = new PandaDoc.DocList({
    mode: PandaDoc.DOC_LIST_MODE.LIST
  });
  doclist.init({
    el: '#pandadoc-list',
    data: {
      docName: '',
      metadata: {
        opportunityId: scene.scene_id
      }
    },
    cssClass: 'pandadoc',
    events: {
      onInit: function() {},
      onDocumentCreate: function() {}
    }
  });

})
