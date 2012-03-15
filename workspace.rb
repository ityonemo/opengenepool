get '/workspace/' do
  if (session[:user])
    dbh=Mysql.real_connect("localhost","www-data","","ogp")

      #modify the workspaces table.
      res = dbh.query("SELECT sequences.title, sequences.id FROM (sequences, workspaces) WHERE workspaces.login = '#{session[:user]}' AND sequences.id = workspaces.sequence")

      @hashes = Array.new

      res.each_hash() do |x| 
        @hashes.push(x)
      end

    dbh.close() if dbh

    haml :workspace
  else
    403.3
  end
end
