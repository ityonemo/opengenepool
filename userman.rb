#userman.rb - manages user stuff.
def amisuperuser()
  #MUST BE CONNECTED TO DB AT THE TIME OF EXECUTION.
  #make sure we have a session username
  if (session[:user] == nil)
    return false
  end

  #let's make sure there are tables (presumably, including a users table)
  if ($DB.tables.length() == 0)
    $DB.disconnect
    return false
  end

  row = $DB["SELECT * FROM users WHERE (login='#{session[:user]}');"].first

  return (Integer(row[:level]) <= 1) #levels one and zero are wheel users.
end

#handle the user stuff off the bat.
def handleuser()
  session[:user] ||= nil
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
begin
  #connect to the database.
  handleuser
  db_connect

  unless amisuperuser
    return 403
  end

  #query the entire list.
  res = $DB["SELECT * FROM users"].all

  #output as the user list utility.
  haml :userlist

ensure
  $DB.disconnect
end
end

get '/makeuser' do
  #TODO: put a user check in place here.
  #no unauthorized access to user creation option.

  haml :makeuser
end

post '/makeuser' do
begin
  #TODO: put a user check in place here.
  #no unauthorized access to user creation.
  handleuser
  db_connect

  unless amisuperuser
    return 403
  end

  login=params[:login]
  email=params[:email]
  passwd=params[:pass]
  error = false
  
  #use a SELECT query to check if the user name exists
  if ($DB['SELECT * FROM users WHERE login = #{login}'].count)
    return 403
  end

  $DB.insert["INSERT INTO users (login, email, hash) VALUES ('#{login}','#{email}',SHA('#{passwd}'))"].insert

  redirect "/makeuser/"
ensure
  $DB.disconnect
end
end
