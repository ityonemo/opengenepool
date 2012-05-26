get '/initialize' do
  
  db_connect
    $tablecount = $DB.tables.length()
  $DB.disconnect
  
  haml :initialize
end

#table descriptors
$TD_USERS = ["id", "login", "name", "email", "level", "hash"]
$TD_SEQUENCES = ["id", "owner", "created", "supercedes", "status", "visibility", "locus", "title", "accession", "definition", 
  "version", "keywords", "source", "organism", "sequence", "type", "class"]
$TD_ANNOTATIONS = ["id", "owner", "sequence", "created", "supercedes", "status", "visibility", "caption", "type", "domain"]
$TD_ANNOTATIONDATA = ["id", "annotation", "infokey", "value"]
$TD_SOURCES = ["id", "parent", "child", "pdomain", "cdomain"]
$TD_WORKSPACES = ["id", "login", "sequence"]

post '/initialize' do

  db_connect

    if ($DB.tables.length == 0)
      $DB.create_table(:users) do
        primary_key	:id
        String		:login,		:size => 15, :index => true, :unique => true
        String		:name,		:size => 255, :index => true
        String		:email,		:size => 255
        Integer		:level
        String		:hash
      end

      $DB["INSERT INTO users (login, name, email, level, hash) VALUES ('#{params[:login]}', '#{params[:name]}', '#{params[:email]}', 0, SHA('#{params[:password]}'));"].insert

      $DB.create_table(:sequences) do
        primary_key 	:id
        String		:owner,		:size => 15
        DateTime	:created
        foreign_key	:supercedes,	:sequences, :index => true
	String		:status,	:size => 15
        String		:visibility,	:size => 15
        String		:locus,		:size => 63, :index => true
        String		:title,		:size => 63, :index => true
        String		:accession,	:size => 63, :index => true
        String		:definition,	:text => true
        String		:version,	:size => 63
        String 		:keywords,	:text => true
        String		:source,	:text => true
        String		:organism,	:text => true
        String          :sequence,	:text => true
        String		:type,		:size => 15
        String		:class,		:size => 15
      end

      $DB.run "ALTER TABLE sequences ADD FOREIGN KEY (owner) REFERENCES users(login)"

      $DB.create_table(:annotations) do
        primary_key	:id
        String		:owner,		:size => 15
        foreign_key	:sequence,	:sequences, :on_delete => :cascade
        DateTime	:created
        foreign_key	:supercedes,	:annotations
        String		:status,	:size => 15
        String		:visibility,	:size => 15
        String		:caption,	:size => 63
        String		:type,		:size => 63
        String		:domain,	:size => 63
      end

      $DB.run "ALTER TABLE annotations ADD FOREIGN KEY (owner) REFERENCES users(login)"

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
        String		:login,		:size => 15
        foreign_key	:sequence,	:sequences, :on_delete => :cascade
      end

      $DB.run "ALTER TABLE workspaces ADD FOREIGN KEY (login) REFERENCES users(login)"
      
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
