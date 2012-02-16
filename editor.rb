require 'json'

get '/editor&:query' do |query|
  handleuser()

  #assemble information necessary for the execution of the editor.
  @scriptlist = ["raphael.js","editor.js","editor_graphics.js"]
  @csslist = ["editor.css"]
  @content = haml :editor
  @otherscripts = '<script type="text/javascript" charset="utf-8"> window.onload = editor.load("' + query + '") </script>'  
  
  #call the OGP template.
  haml :ogp
end

get '/graphics_settings.js' do
  handleuser()

  #for now, simply output fixed values.  Eventually we will pull this from the database.
  content_type :json
  {
    :vmargin => 20,
    :hmargin => 20,
    :zoomlevel => 100,
  }.to_json()
end
