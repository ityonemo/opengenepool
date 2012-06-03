#fork.rb - runs the appropriate procedures for forking DNA sequences.

#simple fork, which directly forks the object.  Returns a json object containing the id of the resulting forked sequence.
post '/fork/:id/:newname' do |id, newname|
begin
  handleuser
  db_connect
  content_type :json

  #STATUS TESTING
  #check to make sure we have write access to the database.
  unless (session[:user])
    return [403, {:error => 403, :detail => "write access denied"}]
  end

  #search for the sequence which we are forking.
  res = $DB["SELECT * FROM sequences WHERE (id = '#{id}')"].first

  #if it doesn't exist, post a 404
  unless (res)
    return [404, {:error => 404}.to_json]
  end

  #make sure we are allowed to see it, push a 403 if not.
  unless ((res[:owner] == session[:user]) || (res[:visibility] == 'public'))
    return [403, {:error => 403, :detail => "read access denied"}.to_json]
  end

  #EXECUTION
  #set new values that are completely overridden.
  res[:owner] = session[:user]
  res[:created] = DateTime.now
  res[:supercedes] = nil
  res[:visibility] = nil
  res[:id] = nil

  #copy sequence in.
  $DB[:sequences].insert(res)

  #find the relevant annotations.
  $DB.run "CREATE TEMPORARY TABLE tann " +
    "SELECT * FROM annotations WHERE (sequence = '#{id}') AND ((visibility = 'public') OR (owner = '#{session[:user]}')"
  
  annores = $DB["SELECT * FROM tann"].all
  annohash = Hash.new

  annores.each do |annot|
    oldindex = annot[:id]
    annot[:owner] = session[:user]
    annot[:created] = DateTime.now
    annot[:supercedes] = nil
    annot[:visibility] = nil
    annot[:id] = nil
    annot[:sequence] = res[:id]

    newindex = $DB[:annotations].insert(annores)
    annohash[oldindex] = newindex
  end

  datares = $DB["SELECT * FROM annotationdata WHERE annotation IN SELECT (id) FROM tann"]

  datares.each do |data|
    data[:owner] = session[:user]
    data[:created] = DateTime.now
    data[:visibility] = nil
    data[:id] = nil
    data[:annotation] = annohash[data[:annotation]]
  end

  #now find the relevant indices.

  res.to_json
ensure
  $DB.disconnect  
end
end
