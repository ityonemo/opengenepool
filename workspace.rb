require 'json'

get '/workspace' do
begin
  handleuser
  db_connect
  content_type :json  

  #STATUS CHECK
  unless (session[:user])
    return [403, {:error => 403, :details => "not logged in"}.to_json]
  end

  #modify the workspaces table.
  res = $DB["SELECT sequences.title, sequences.id FROM (sequences, workspaces) WHERE workspaces.login = '#{session[:user]}' " +
      "AND sequences.id = workspaces.sequence"].all

  res.to_json

ensure
  $DB.disconnect
end
end
