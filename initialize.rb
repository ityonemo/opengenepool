get '/initialize' do
<<<<<<< Updated upstream
  dbh=Mysql.real_connect("localhost","www-data","","ogp")
    $tablecount = dbh.list_tables.length()
  dbh.close if dbh

=======
  
  db_connect
    $tablecount = $DB.tables.length
  $DB.disconnect
  
>>>>>>> Stashed changes
  haml :initialize
end

post '/initialize' do
<<<<<<< Updated upstream
<<<<<<< Updated upstream
  dbh=Mysql.real_connect($dbhost,$dblogin,$dbpass, $dbname)
    if (dbh.list_tables.length() == 0)
=======
  db_connect
>>>>>>> Stashed changes
=======
  db_connect
>>>>>>> Stashed changes

  if ($DB.tables.length == 0)
    #create the users table
    $DB.create_table(:users) do
      primary_key	:id
      String		:login,		:size => 15, :index => true, :unique => true
      String		:email,		:size => 63, :index => true
      String		:name,		:index => true
      Integer		:level
      String		:hash
    end

    #insert the superuser into the table.
    $DB[:users].insert(
      :login => params[:login],
      :name => params[:name],
      :email => params[:email],
      :hash => "SHA(#{params[:password]})",
      :level => 0)


    #create the sequences table
    $DB.create_table(:sequences) do
      primary_key 	:id
      foreign_key	:owner, 	:users, :key => :login
      DateTime		:created
      foreign_key	:supercedes,	:sequences
      String		:status,	:size => 63
      String		:visibility,	:size => 63
      String		:locus,		:size => 63, :index => true
      String		:title,		:size => 63, :index => true
      String		:accession,	:size => 63, :index => true
      String		:definition,	:text => true
      String		:version,	:size => 63
      String		:keywords,	:text => true
      String		:source,	:text => true
      String		:organism,	:text => true
      String		:sequence,	:text => true
      String		:type,		:size => 63
      String		:class,		:size => 63
    end

    $DB.create_table(:annotations) do
      primary_key	:id
      foreign_key	:owner,		:users, :key => :login
      foreign_key	:sequence,	:sequences, :on_delete => :cascade
      DateTime		:created
      foreign_key	:supercedes,	:annotations
      String		:status,	:size => 63
      String		:visibility,	:size => 63
      String		:caption,	:text => true
      String		:type,		:size => 63
      String		:domain,	:size => 63
    end

    $DB.create_table(:annotationdata) do
      primary_key	:id
      foreign_key	:annotation,	:annotations, :on_delete => :cascade
      String		:infokey,	:size => 63
      String		:value,		:text => true
    end

    $DB.create_table(:sources) do
      primary_key	:id
      foreign_key	:parent,	:sequences, :on_delete => :cascade
      foreign_key	:child,		:sequences, :on_delete => :cascade
      String		:pdomain,	:size => 63
      String		:cdomain,	:size => 63
    end

    $DB.create_table(:workspaces) do
      primary_key	:id
      foreign_key	:login,		:users, :key => :login, :on_delete => :cascade
      foreign_key	:sequence,	:sequences, :on_delete => :cascade
    end

  end

  $DB.disconnect

  redirect '/'
end

get '/nuke' do
  if (amisuperuser)
    db_connect
      $DB.drop_table(:workspaces)
      $DB.drop_table(:sources)
      $DB.drop_table(:annotationdata)
      $DB.drop_table(:annotations)
      $DB.drop_table(:sequences)
      $DB.drop_table(:users)
    $DB.disconnect

    "the database has been nuked."
  else
    403
  end
end
