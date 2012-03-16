#fork.rb - runs the appropriate procedures for forking DNA sequences.
#the correct way to specify construct name is to 

require 'mysql'

post '/annotation/:query' do |query|
  handleuser()

  if (session[:user])
    dbh=Mysql.real_connect("localhost","www-data","","ogp")
      

    dbh.close if dbh
  else
    status 403.3
  end
end

delete '/annotation/:query' do |query|
  handleuser()
  if (session[:user])
    error = false
    dbh=Mysql.real_connect("localhost","www-data","","ogp")
      #first check to see if the annotation exists.
      res = dbh.query("SELECT * FROM annotations WHERE (id='" + query + "');")
      if (res.num_rows() < 1)
        error = 404
        #we should check to make sure we own this annotation.
      elsif (res.fetch_hash()["owner"] != session[:user])
        error = 403.3
      else
        #passed
        res = dbh.query("DELETE FROM annotations WHERE (id='" + query + "');")
      end
    dbh.close if dbh

    #spit out the error if we've managed one, otherwise, keep it cool.
    if (error)
      error
    else
      200
    end

  else
    status 403.3
  end
end
