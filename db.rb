#db.rb -- provides database information as JSON

#a database query contains the following information:

def accept_sanitized (table, column, query)
  unless $DB.table_exists? table 
    return false
  end
  return true
end

get '/db/:table/:column/:query' do |table, column, query|
begin
  handleuser
  db_connect
  content_type :json

  #sanitization step
  unless accept_sanitized(table, column, query)
    return [406, {:error => 406}.to_json]
  end

  #security protection step.
  #TODO:  improve security here (for example, to prevent access to the users database.
  if ($DB.schema(table).index {|i| i[0] == "owner"})
    result = $DB["SELECT * FROM #{table} WHERE (#{column} = #{query}) AND ((visibility = public) OR (owner = #{session[:user]}))"].all
  else
    result = $DB["SELECT * FROM #{table} WHERE (#{column} = #{query})"].all
  end

  result.to_json
ensure
  $DB.disconnect
end
end
