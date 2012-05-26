#userman.rb - manages user stuff.
def amisuperuser()
  #make sure we have a session username
  if (session[:user] == nil)
    return false
  end

  db_connect

    #let's make sure there are tables (presumably, including a users table)
    if ($DB.tables.length() == 0)
      $DB.disconnect
      return false
    end

    row = $DB["SELECT * FROM users WHERE (login='#{session[:user]}');"].first

  $DB.disconnect

  return (Integer(row[:level]) <= 1) #levels one and zero are wheel users.
end

#handle logins.  Will redirect to the "callback" parameter, if available;
#the callback path is set if a non-user-dependent webpage is accessed.
#TODO: handle returning the user to the path they logged in from.

post '/login' do
  #access parameters.
  login = params[:login]
  password = params[:pass]
  callback = params[:callback]

  #TODO: sanitize so that we don't have a mysql injection attack.

  #check to make sure that this user exists:
  db_connect

    res = $DB["SELECT * FROM users WHERE (login='#{login}' AND hash=SHA('#{password}'));"].all

    #set the session variable.
    if (res)
      if (res.size == 1)
        session[:user] = login
      end
    end

  $DB.disconnect

  #generate the redirect.
  redirect (callback.nil? && "/") || callback
end

#handle clearing the logout.  Redirects back to the main page, always.
get '/logout' do
  session[:user] = nil
  redirect "/"
end

get '/whoami' do
  "<html>" + session[:user] + "</html>"
end

get '/userlist' do
  #TODO: put a user check in place here.
  #we don't want unauthorized access to this list.

  unless amisuperuser
    return 403.3
  end

  #connect to the database.
  db_connect

    #query the entire list.
    @res = $DB["SELECT * FROM users"].all

  $DB.disconnect

  #output as the user list utility.
  haml :userlist
end

get '/makeuser' do
  #TODO: put a user check in place here.
  #no unauthorized access to user creation option.

  haml :makeuser
end

post '/makeuser' do
  #TODO: put a user check in place here.
  #no unauthorized access to user creation.

  unless amisuperuser
    return 403.3
  end

  login=params[:login]
  email=params[:email]
  passwd=params[:pass]
  error = false
  
  #check to make sure that the name doesn't exist in the database already.
  db_connect

    #use a SELECT query to check if the user name exists
    check = $DB['SELECT * FROM users WHERE login = #{login}'].all
   
    #to be successful, the count has to be zero.
    if (check.size != 0)
      error = true;
    else
      $DB["INSERT INTO users (login, email, hash) VALUES ('#{login}','#{email}',SHA('#{passwd}'))"].insert
      #TODO: error checking and handling. 
    end

  dbh.close if dbh

  if (error)
    "error, try a different name."
  else
    redirect "/makeuser/"
  end
end
