#annotations.rb - runs the appropriate procedures for handling DNA annotations.
#the correct way to specify construct name is to 

#GET returns an annotation, or an error, and always responds with json.
get '/annotation/:query' do |query|
begin
  handleuser
  db_connect 
  content_type :json

  #STATUS TESTING
  res = $DB["SELECT * FROM annotations WHERE (id = '#{query}');"].first
  #check to make sure it exists.
  unless (res)
    return [404, {:error => 404}.to_json]
  end
  #check to make sure we can see it
  unless ((res[:owner] == session[:user]) || (res[:visibility] == "public"))
    return [403, {:error => 403, :details => "read access denied"}.to_json]
  end

  #EXECUTION

  #simple!
  res.to_json
ensure
  $DB.disconnect
end
end

#POST returns an annotation id, or an error, and always responds with json (to avoid triggering sinatra's route
#response matching in the case that the annotation's id happens to be an http error code.)
post '/annotation/' do
begin
  handleuser
  db_connect
  content_type :json

  #STATUS TESTING
  #make sure we're logged in or else you can't post new annotations.
  unless (session[:user])
    return [403, {:error => 403, :details => "write access denied"}.to_json]
  end

  #check to make sure the sequence we're trying to annotate exists.
  unless ($DB["SELECT * FROM sequences WHERE (id = '#{params[:seqid]}');"].count)
    return [404, {:error => 404}.to_json]
  end

  #execution

  #create the insert command from whole cloth.
  annid = $DB[:annotations].insert(
    :sequence => params[:seqid], 
    :caption => params[:caption],
    :type => params[:type],
    :domain => params[:domain], 
    :created => DateTime.now, 
    :owner => session[:user])

  #TODO:  Add "extra data" here.

  #return to the browser the added annotation id.
  {:annotation => annid}.to_json
ensure
  $DB.disconnect
end
end

#PATCH returns an annotation id, or an error, and always responds with json (to avoid triggering sinatra's route
#response matching in the case that the annotation's id happens to be an http error code.)
patch '/annotation/:query' do |query|
begin
  handleuser
  db_connect
  content_type :json

  #STATUS TESTING
  #make sure we're logged in or else you can't post changes to annotations.
  unless (session[:user])
    return [403, {:error => 403, :details => "write access denied"}.to_json]
  end
  
  res = $DB["SELECT * FROM annotations WHERE (id = '#{params[:query]}');"].first

  #make sure the annotation specified exists.
  unless (res)
    return [404, {:error => 404}.to_json]
  end

  #EXECUTION
  #set new values that are completely overridden.
  res[:owner] = session[:user]
  res[:created] = DateTime.now
  res[:supercedes] = res[:id]
  res[:id] = nil

  #precessively patch the object.
  res[:caption] ||= params[:caption]  # === if (params[:caption]) res[:caption] = params[:caption]
  res[:type] ||= params[:type]
  res[:domain] ||= params[:domain]
   
  annid = $DB[:annotations].insert(res)

  #TODO: insert additional data fields.
  {:annotation => annid}.to_json
ensure
  $DB.disconnect
end
end

#delete only responds with an HTTP code.
delete '/annotation/:query' do |query|
begin
  handleuser
  db_connect

  #STATUS TESTING
  #make sure we're logged in.
  unless (session[:user])
    return 403
  end

  query = $DB["SELECT * FROM annotations WHERE (id='#{query}');"]
  res = query.first

  #make sure the specified annotation exists
  unless (res)
    return 404
  end

  #make sure user owns this data.
  unless (res[:owner] == session[:user])
    return 403
  end

  #EXECUTION
  #merely flag the object as deleted.
  query.update(:status => 'deleted')

  #http 200, baby!
  200
ensure
  $DB.disconnect
end
end
