#annotations.rb - runs the appropriate procedures for handling DNA annotations.
#the correct way to specify construct name is to 

require 'mysql'

post '/annotation/' do
  handleuser()

  if (session[:user])
    error = false

    dbh=Mysql.real_connect("localhost","www-data","","ogp")
      #check to make sure the sequence we're trying to annotate exists.
      res = dbh.query("SELECT * FROM sequences WHERE (id='" + params[:seqid] + "');")
      if (res.num_rows() != 0)
        res = dbh.query("INSERT INTO annotations (sequence, caption, type, domain, created, owner)" +
        " VALUES ('#{params[:seqid]}', '#{params[:caption]}', '#{params[:type]}', '#{params[:domain]}', " +
        " NOW(), '#{session[:user]}');")

        $annotation_id_string = dbh.insert_id().to_s
      else
        error = 404
      end
    dbh.close if dbh

    #do an error check
    if (error)
      error
    else
      $annotation_id_string
    end

  else
    status 403.3
  end
end

patch '/annotation/:query' do |query|
  handleuser()
  if (session[:user])
    error = false
    dbh=Mysql.real_connect("localhost","www-data","","ogp")
      #check to make sure if the annotation exists.
      res = dbh.query("SELECT * FROM annotations WHERE (id='" + query + "');")
      if (res.num_rows() < 1)
        error = 404
      else
        #we're not actually going to change the old annotation.  Instead, we are actually going to:
        #copy the annotation to a temporary table.  
        res = dbh.query("CREATE TEMPORARY TABLE tann SELECT * FROM annotations WHERE id='#{query}';")
        #strip the contents of the id.
        res = dbh.query("ALTER TABLE tann DROP id")
        #replace contents, creating the critical 'supercedes' parameter.

        res = dbh.query("UPDATE tann SET owner='#{session[:user]}', " +
          "caption='#{params[:caption]}', type='#{params[:type]}', domain='#{params[:domain]}', " +
          "supercedes='#{query}', created=NOW();")

        @cols = columnsfrom(dbh, "annotations")
        #put the temporary table into place
        res = dbh.query("INSERT INTO annotations (#{@cols}) SELECT * FROM tann")

        $annotation_id_string = dbh.insert_id().to_s
      end
    dbh.close if dbh

    #do an error check.
    if (error)
      error
    else
      $annotation_id_string
    end
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
        res = dbh.query("UPDATE annotations SET status='deleted' WHERE (id='" + query + "')")
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
