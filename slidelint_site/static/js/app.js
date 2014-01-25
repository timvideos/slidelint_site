LinterApp = angular.module('LinterApp', ['angularFileUpload', 'ui.bootstrap']);

var LinterCtrl = ['$scope', '$upload', '$http', '$timeout', '$modal',
  function($scope, $upload, $http, $timeout, $modal) {
  $scope.state = 'upload';
  $scope.check_rule = 'simple';
  $scope.validation_error = null;
  $scope.job_uid = false;
  $scope.error = false;
  $scope.results = [];
  $scope.show_upload = function(){
    $scope.state = 'upload';
  }
  $scope.getResults = function(){
    if ($scope.job_uid !== false){
      $http.post('/results', {'uid': $scope.job_uid},
          {headers: {'Content-Type': 'application/json'}})
        .success(function(data, status, headers, config) {
            $scope.job_uid = false;
            $scope.uploading_progress = 0;
            $scope.icons = data.icons;
            $scope.results = data.result;
            $scope.state = 'results';
        }).
        error(function(data, status, headers, config) {
          // called asynchronously if an error occurs
          // or server returns response with an error status.
          if (status === 500) {
              $scope.job_uid = false;
              $scope.uploading_progress = 0;
              $scope.error = data.result;
              $scope.state = 'results';
          };
        });
    };
  };
  $scope.intervalFunction = function(){
    $timeout(function() {
      $scope.getResults();
      $scope.intervalFunction();
    }, 3000)
  };
  $scope.intervalFunction();
  $scope.onFileSelect = function($files) {
    //$files: an array of files selected, each file has name, size, and type.
    for (var i = 0; i < $files.length; i++) {
      var file = $files[i];
      $scope.upload = $upload.upload({
        url: '/upload',
        // method: POST or PUT,
        // headers: {'headerKey': 'headerValue'}, withCredential: true,
        data: {check_rule: $scope.check_rule},
        file: file,
        // file: $files, //upload multiple files, this feature only works in HTML5 FromData browsers
        /* set file formData name for 'Content-Desposition' header. Default: 'file' */
        //fileFormDataName: myFile,
        /* customize how data is added to formData. See #40#issuecomment-28612000 for example */
        //formDataAppender: function(formData, key, val){}
      }).progress(function(evt) {
        $scope.uploading_progress = parseInt(100.0 * evt.loaded / evt.total);
      }).success(function(data, status, headers, config) {
        // file is uploaded successfully
        // data = JSON.parse(data);
        uid = data.uid;
        rez_status = data.status;
        $scope.job_uid = uid;
        $scope.state = 'progress';
      }).error(function(data, status, headers, config) {
         $scope.validation_error = data.error;
      }).then(success, error, progress);
    }
  };

}];
