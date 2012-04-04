require 'json'

get '/editor/:query' do |query|
  handleuser()

  #list of plugins this user is using.
  #TODO:  Make thes load from the database.
  @pluginlist= ["sequence","annotations","selection", "find"]

  #assemble information necessary for the execution of the editor.
  @scriptlist = ["/raphael.js","editor.js","editor_graphics.js", "editor_files.js","DNA.js"]
  @csslist = ["editor.css"]

  @pluginlist.each do |@j|
    @scriptlist.push("plugin_" + @j + ".js")
    @csslist.push("plugin_" + @j + ".css")
  end

  @content = haml :editor

  #set up the script.  first the window onload.
  @otherscripts = 'window.onload = editor.load("' + query + '");' + "\n" +
    'plugins = [' + @pluginlist.join(",") + '];'

  if (session[:user])
    @otherscripts += "\n user_loggedin = true;"
  else
    @otherscripts += "\n user_loggedin = false;"
  end

  #call the OGP template.
  haml :ogp
end

get '/settings/graphics_settings.js' do
  handleuser()

  #for now, simply output fixed values.  Eventually we will pull this from the database.
  content_type :json
  {
    :vmargin => 20,
    :lmargin => 80,
    :rmargin => 20,
    :zoomlevel => 100,
    :linepadding => 2,
  }.to_json()
end
