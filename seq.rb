#seq.rb - provides sequence information when queried.

get '/seq/:query' do |query|
begin
  handleuser
  db_connect

  #check to see if we are using the id.
  if (query[0..2].eql?("id="))
    @res = $DB["SELECT * FROM sequences WHERE (id='"+ query[3..-1] +"');"].first
  else
    @res = $DB["SELECT * FROM sequences WHERE (title='#{query}');"].first
  end

  #STATUS TESTING
  #did we find the sequence?  if not, 404.
  unless (@res)
    return 404
  end

  unless ((@res[:owner] == session[:user]) || (@res[:visibility] == "public"))
    return 403
  end

  #EXECUTION

  #create a table with all of the annotations that reference the sequence.
  $DB.run "CREATE TEMPORARY TABLE tann SELECT * FROM annotations WHERE (sequence = #{@res[:id]});"
  #remove the deleted annotations.
  $DB.run "DELETE FROM tann WHERE status='deleted';"

  #then create a subtable with the annotations that supercede another annotation.
  $DB.run "CREATE TEMPORARY TABLE tann2 SELECT (supercedes) FROM tann WHERE (supercedes > 0);"
  #remove the superceded annotations
  $DB.run "DELETE FROM tann WHERE id IN (SELECT id FROM tann2);"

  @annotations = $DB["SELECT * FROM tann;"].all
  @annodata = $DB["SELECT * FROM annotationdata WHERE annotation IN (SELECT id FROM tann);"].all

  #push it to the query xml generator
  haml :query

ensure
  $DB.disconnect
end
end

get "/sequence/:query" do |query|
begin
  handleuser
  db_connect
  content_type :json

  #check to see if we are using the id.
  if (query[0..2].eql?("id="))
    res = $DB["SELECT * FROM sequences WHERE (id='"+ query[3..-1] +"');"].first
  else
    res = $DB["SELECT * FROM sequences WHERE (title='#{query}');"].first
  end

  #STATUS TESTING
  #did we find the sequence?  if not, 404.
  unless (res)
    return [404, {:error => 404}.to_json ]
  end

  unless ((res[:owner] == session[:user]) || (res[:visibility] == "public"))
    return [403, {:error => 403, :details => "read access denied"}.to_json ]
  end

  #EXECUTION
  #easy peasy.
  res.to_json
ensure
  $DB.disconnect
end
end
