# slidelint Site

slidelint site allows users to check theirs presentation with [slidelint](
https://github.com/enkidulan/slidelint) through web interface on-line.

This repository contain buildout and sources for slidelint site.

# Setting up a slidelint site

## System requirements

The site requires the packages are installed on your system:
 * python3-devel
 * libevent-devel
 * zeromq3-devel
 * docker??
 * ???

In Ubuntu you can install them with the following command
```bash
apt-get install python3-dev libevent-dev libzmq3-dev
```

## Starting the Site

Run the command
```bash
bin/circusd circus.ini
```

## Configuring the Site

You can configure site by editing buildout.cfg.

The two sections you are likely to be intrested in are;

 * The mailing configuration. This controls where error messages are sent.

```INI
[mailing_config]
mailloger_host = localhost
mailloger_from = notification@example.com
mailloger_to = manager@example.com
mailloger_subject = SlideLint: Error has occurred
# credentials should be written as ", ('name', 'password')"
mailloger_credentials =
mail_subject = Slidelint: feedback received
mail_port = 25
```

 * The second is worker config. This controls how workers are created and set up.

```INI
[worker_config]
slidelint = docker run -t -c 4 -v {default_config_path}:/config -v {presentation_location}:/presentation --networking=false slidelint/box slidelint -f json --files-output=/presentation/{presentation_name}.res --config={config_path} /presentation/presentation.pdf
onetime = true
debug_url =
```

# Site Structure

This site is separated into three parts:
 * User front-end, that users interact with.
 * Server back-end, that queues the linting process to be done.
 * Workers, that actually perform presentations linting with slidelint.

The system works as follows;
 * The user provided file is ?sent? from the front-end to the backend.
 * Backend takes the file and add new job to queue.
 * Free worker picks up the job, preforms linting, sending the results to the
   collector.

When job is added to queue front-end start asking backend about results until
it until receive them.

![Queue Manager Scheme](slidelint_site_queue_manager_scheme.jpeg)


## Front-end

This part of the system allows users to upload presentations files, shows the
uploading process and waiting message, and finally shows users results.

The front-end is based on [Angular](https://angularjs.org).

Files related to front-end:
 * `slidelint_site/templates/index.pt` - main page that loads angular app
 * `slidelint_site/static` - static resources(images, css, js, ...)
 * `slidelint_site/static/js/app.js` - angular application that
   implements front-end behavior
 * `slidelint_site/static/templates/waiting.html` - template for modal
   dialog that shows uploading progress and waiting message

### Linting

Linting process is three steps:

 1. Showing visitor a file loading form (also it make sense to check file type
    and size on this step).
 2. Showing awaiting form (and sending file to server, and waiting for
    results).
 3. Showing slide linting results (and in case if something goes wrong we
    should show to user 'try later' message, or something like that).


## Backend

### Queuing and Worker(s)

We use the "OMQ" found at http://zeromq.org

Overall, the system works like follows;
 * Website puts something into the queue.
 * Worker gets item from queue and puts results somewhere.
 * Website polls to find out the result.

### Queue Manager

Code for the Queue Manager is in `slidelint_site/queue_manager.py`

It's a python queue that use zmq 
[Divide-and-Conquer model](http://zguide.zeromq.org/page:all#Divide-and-Conquer)
to communicate with its workers.

Right now it uses tcp protocol, so the worker can be separate from the site,
even on other machine.


## Workers

Files related to workers:
 * `slidelint_site/slidelint_site/worker.py`
 * `slidelint_site/slidelint_site/utils.py`

As the worker could be on it's own machine, the worker uses its own
configuration file.

For our system;
 * We want to "throw away" each worker after it has completed a job.
 * We want the possibility of multiple workers running at the same time.


### "throw away" each worker after it has completed a job

Circus is used for managing workers - http://circus.readthedocs.org/en/latest/
It allows not only control a number of running processes, but also a lot of
other things like:
 * `max_age` (https://circus.readthedocs.org/en/0.9.2/configuration/).

FIXME(enkidulan): Fix the following:
  Multiple workers can be running at the same time. In task "throw away", each
  worker after it has completed a job, the number of workers is increased. I make
  them "die" all the time, so it's a try to balance ??

### Worker Sandboxing

We use docker for sanboxing / worker creation - https://docker.io/

The docker image slidelint/box is where slidelint was installed and
configuration files was added.

The sandboxed slidelint check look like this
```bash
docker run -t -v {presentation_location}:/presentation --networking=false slidelint/box slidelint -f json --files-output=/presentation/{presentation_name}.res /presentation/presentation.pdf
```

The options are:
 * `-t` - Allocate a pseudo-tty
 * `-v {presentation_location}:/presentation` -
    mounting directory from computer to docker session. All directory content
    will be reachable in "/presentation" directory at docker envirovment.
 * `--networking=false` - disabling network access from running session
 * `slidelint -f json --files-output=/presentation/{presentation_name}.res /presentation/presentation.pdf` - here goes slidelint itself.

Any changes which were made inside session wouldn't be persistent.

# Errors handling

We have two separated applications - site and slidelint worker, so we can have
different logging handlers for each of them:

 * site will send full error trace-back to site administrator.
 * slidelint worker will save incoming PDF presentation file and send
   to administrator error trace-back with link to presentation.

There are also error logs in the `var` directory:
 * site_errors.log
 * site.log
 * worker_errors.log
 * workers.log

Incoming documents which cause issues will be saved to `debug_storage`
directory for review with details about what happened.

People can aso reports errors via a feedback form.

## SMTP logging handler

The message looks like:

```
 2014-02-01 02:44:21,372 - root - ERROR -
    Slidelint process died while trying to check presentation.
    You can access this presentation by link
    http://slidelint.enkidulan.tk/debug/.../presentation.pdf.
    The command: 'slidelint -f json ...' died with the following traceback:

        Traceback (most recent call last):
        File "slidelint", line 9, in <module>  load_entry_point('slidelint==1.0dev', 'console_scripts', 'slidelint')()
        File "cli.py", line 106, in cli  lint(target_file, config_file, output, enable_disable_ids, msg_info)
        File "cli.py", line 89, in lint  output['files_output'], output['ids'])
        File "outputs.py", line 151, in output_handler  formated_report = formater(rezults)
        File "outputs.py", line 18, in __call__  filtred = [msg for msg in report if msg['id'] not in self.mute_ids]
        File "utils.py", line 88, in __iter__  raise IOError(checker_rez)
        IOError: The function 'wrapped' of 'slidelint.utils' module raised an Exception:
        No /Root object! - Is this really a PDF?
```

## Feedback form and view

There is a feedback form on the results page. It sends emails with the body
which looks like:

    Job id: ddb93ff1750248cdad8292eabd901f3a
    Feedback text:
    some feedback text some feedback text some feedback text some


# Validators

Add file size and file type validators to front-end and back-end

Added validators with following commits:

 * back-end validators: 9de688d7be51a133043da3a4a370dbd2c871e1c1
 * front-end validation 3fd468e114660ebb017159d56de38ff8c815ba0c
 * front-end validators: 77e010cb6a5532f4904c5150e97c2abc4ede9adc
