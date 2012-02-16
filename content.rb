get '/xml/:content' do |content|
  #may need to sanitize input here.

  haml :"#{content}"
end
