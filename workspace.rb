require 'json'

get '/workspace/' do
  if (session[:user])
    dbh=Mysql.real_connect($dbhost,$dblogin,$dbpass, $dbname)

      #modify the workspaces table.
      res = dbh.query("SELECT sequences.title, sequences.id FROM (sequences, workspaces) WHERE workspaces.login = '#{session[:user]}' AND sequences.id = workspaces.sequence")

      @hashes = Array.new

      res.each_hash() do |x| 
        @hashes.push(x)
      end

    dbh.close() if dbh

    content_type :json
    @hashes.to_json
  else
    403.3
  end
end
