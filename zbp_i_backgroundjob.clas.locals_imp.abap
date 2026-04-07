*"* use this source file for the definition and implementation of
*"* local helper classes, interface definitions and type
*"* declarations

CLASS lhc_JobList DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.

    METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
      IMPORTING keys REQUEST requested_authorizations FOR JobList RESULT result.

    METHODS read FOR READ
      IMPORTING keys FOR READ JobList RESULT result.

    METHODS lock FOR LOCK
      IMPORTING keys FOR LOCK JobList.

    METHODS ScheduleJob FOR MODIFY
      IMPORTING keys FOR ACTION JobList~ScheduleJob RESULT result.

    " --- ĐÃ SỬA: BỎ DẤU CHẤM SAU DeleteJob ĐỂ NHẬN RESULT ---
    METHODS DeleteJob FOR MODIFY
      IMPORTING keys FOR ACTION JobList~DeleteJob RESULT result.
    " --- STOP JOB ---
    METHODS StopJob FOR MODIFY
      IMPORTING keys FOR ACTION JobList~StopJob RESULT result.

    METHODS ReleaseJob FOR MODIFY
      IMPORTING keys FOR ACTION JobList~ReleaseJob RESULT result.

    METHODS RepeatWithSchedule FOR MODIFY
      IMPORTING keys FOR ACTION JobList~RepeatWithSchedule RESULT result.


    METHODS CopyJob FOR MODIFY
      IMPORTING keys FOR ACTION JobList~CopyJob RESULT result.

ENDCLASS.

CLASS lhc_JobList IMPLEMENTATION.

  METHOD get_instance_authorizations.
  ENDMETHOD.

  METHOD ReleaseJob.

    DATA: lv_jobcount  TYPE tbtcjob-jobcount,
          lv_strtimmed TYPE btch0000-char1,
          lv_sdlstrtdt TYPE sy-datum,
          lv_sdlstrttm TYPE sy-uzeit.

    READ TABLE keys INTO DATA(ls_input) INDEX 1.
    DATA(ls_params) = ls_input-%param.

    LOOP AT keys INTO DATA(ls_key).

      "================= 1. Convert JobCount =================
      lv_jobcount = ls_key-JobCount.

      CALL FUNCTION 'CONVERSION_EXIT_ALPHA_INPUT'
        EXPORTING
          input  = lv_jobcount
        IMPORTING
          output = lv_jobcount.

      "================= 2. Immediate =================
      CLEAR: lv_strtimmed, lv_sdlstrtdt, lv_sdlstrttm.

      IF ls_params-IsImmediate = abap_true OR ls_params-IsImmediate = 'X'.
        lv_strtimmed = 'X'.
        lv_sdlstrtdt = sy-datum.
        lv_sdlstrttm = sy-uzeit.
      ELSE.
        lv_sdlstrtdt = ls_params-StartDate.
        lv_sdlstrttm = ls_params-StartTime.
      ENDIF.

      "================= 3. RELEASE =================
      CALL FUNCTION 'JOB_CLOSE'
        EXPORTING
          jobcount             = lv_jobcount
          jobname              = ls_key-JobName
          strtimmed            = lv_strtimmed
          sdlstrtdt            = lv_sdlstrtdt
          sdlstrttm            = lv_sdlstrttm
        EXCEPTIONS
          cant_start_immediate = 1
          invalid_startdate    = 2
          job_not_released     = 3
          OTHERS               = 4.

      "================= 4. RESULT =================
      IF sy-subrc = 0.

        IF ls_params-IsImmediate = abap_true OR ls_params-IsImmediate = 'X'.
          CALL FUNCTION 'BP_JOB_RELEASE'
            EXPORTING
              jobcount = lv_jobcount
              jobname  = ls_key-JobName
            EXCEPTIONS
              OTHERS   = 1.
        ENDIF.

        APPEND VALUE #(
          %tky = ls_key-%tky
          %msg = new_message_with_text(
                   severity = if_abap_behv_message=>severity-success
                   text     = |Job { ls_key-JobName } đã release thành công| )
        ) TO reported-joblist.

      ELSE.

        APPEND VALUE #( %tky = ls_key-%tky ) TO failed-joblist.

        APPEND VALUE #(
          %tky = ls_key-%tky
          %msg = new_message_with_text(
                   severity = if_abap_behv_message=>severity-error
                   text     = |JOB_CLOSE lỗi ({ sy-subrc }) - { ls_key-JobName }/{ lv_jobcount }| )
        ) TO reported-joblist.

      ENDIF.

    ENDLOOP.

    "================= 5. REFRESH =================
    READ ENTITIES OF z_i_backgroundjob IN LOCAL MODE
      ENTITY JobList
      ALL FIELDS
      WITH CORRESPONDING #( keys )
      RESULT DATA(lt_refreshed).

    result = VALUE #(
      FOR res IN lt_refreshed
        ( %tky = res-%tky
          %param = res )
    ).

  ENDMETHOD.

  METHOD RepeatWithSchedule.
    DATA: lv_source_jc TYPE tbtcjob-jobcount,
          lv_new_jc    TYPE tbtcjob-jobcount,
          lt_steps     TYPE TABLE OF tbtcp,
          lv_strtimmed TYPE btch0000-char1,
          lv_sdlstrtdt TYPE sy-datum,
          lv_sdlstrttm TYPE sy-uzeit.

    " 1. Lấy tham số từ Popup
    READ TABLE keys INTO DATA(ls_input) INDEX 1.
    DATA(ls_params) = ls_input-%param.

    LOOP AT keys INTO DATA(ls_key).
      "================= 2. Chuẩn bị Job gốc =================
      lv_source_jc = ls_key-JobCount.
      CALL FUNCTION 'CONVERSION_EXIT_ALPHA_INPUT'
        EXPORTING input  = lv_source_jc
        IMPORTING output = lv_source_jc.

      "================= 3. Mở Job vỏ mới (JOB_OPEN) =================
      CALL FUNCTION 'JOB_OPEN'
        EXPORTING
          jobname  = ls_key-JobName
        IMPORTING
          jobcount = lv_new_jc
        EXCEPTIONS
          OTHERS   = 1.

      IF sy-subrc = 0.
        "================= 4. Copy Programs từ Job cũ =================
        SELECT * FROM tbtcp INTO TABLE @lt_steps
          WHERE jobname  = @ls_key-JobName
            AND jobcount = @lv_source_jc.

        LOOP AT lt_steps INTO DATA(ls_step).
          CALL FUNCTION 'JOB_SUBMIT'
            EXPORTING
              authcknam = sy-uname
              jobcount  = lv_new_jc
              jobname   = ls_key-JobName
              report    = ls_step-progname
              variant   = ls_step-variant
            EXCEPTIONS
              OTHERS    = 1.
        ENDLOOP.

        "================= 5. Áp dụng Lịch trình =================
        CLEAR: lv_strtimmed, lv_sdlstrtdt, lv_sdlstrttm.

        IF ls_params-IsImmediate = abap_true OR ls_params-IsImmediate = 'X'.
          lv_strtimmed = 'X'.
          lv_sdlstrtdt = sy-datum.
          lv_sdlstrttm = sy-uzeit.
        ELSE.
          lv_sdlstrtdt = ls_params-StartDate.
          lv_sdlstrttm = ls_params-StartTime.
        ENDIF.

        "================= 6. Chốt hạ Job (JOB_CLOSE) =================
        CALL FUNCTION 'JOB_CLOSE'
          EXPORTING
            jobcount     = lv_new_jc
            jobname      = ls_key-JobName
            strtimmed    = lv_strtimmed
            sdlstrtdt    = lv_sdlstrtdt
            sdlstrttm    = lv_sdlstrttm
          EXCEPTIONS
            OTHERS       = 1.

        IF sy-subrc = 0.
          IF ls_params-IsImmediate = abap_true OR ls_params-IsImmediate = 'X'.
            CALL FUNCTION 'BP_JOB_RELEASE'
              EXPORTING
                jobcount = lv_new_jc
                jobname  = ls_key-JobName
              EXCEPTIONS
                OTHERS   = 1.
          ENDIF.

          APPEND VALUE #( %tky = ls_key-%tky
                          %msg = new_message_with_text( severity = if_abap_behv_message=>severity-success
                                                        text = |Nhân bản thành công! ID mới: { lv_new_jc }| )
                        ) TO reported-joblist.
        ELSE.
          APPEND VALUE #( %tky = ls_key-%tky ) TO failed-joblist.
        ENDIF.
      ELSE.
        APPEND VALUE #( %tky = ls_key-%tky ) TO failed-joblist.
      ENDIF.
    ENDLOOP.

    "================= 7. Refresh UI =================
    READ ENTITIES OF z_i_backgroundjob IN LOCAL MODE
      ENTITY JobList ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(lt_refreshed).

    result = VALUE #( FOR res IN lt_refreshed ( %tky = res-%tky %param = res ) ).
  ENDMETHOD.


  METHOD CopyJob.
    DATA: lv_new_id      TYPE btcjobcnt,
          lt_steps       TYPE TABLE OF tbtcp,
          lv_target_name TYPE btcjob.

    " 1. Lấy tên mới từ Popup
    READ TABLE keys INTO DATA(ls_input) INDEX 1.
    DATA(lv_input_name) = ls_input-%param-NewJobName.

    LOOP AT keys INTO DATA(ls_key).
      lv_target_name = COND #( WHEN lv_input_name IS INITIAL
                               THEN ls_key-JobName
                               ELSE lv_input_name ).

      DATA(lv_source_count) = ls_key-JobCount.
      CALL FUNCTION 'CONVERSION_EXIT_ALPHA_INPUT'
        EXPORTING
          input  = lv_source_count
        IMPORTING
          output = lv_source_count.

      " Bước A: Mở Job mới
      CALL FUNCTION 'JOB_OPEN'
        EXPORTING
          jobname  = lv_target_name
        IMPORTING
          jobcount = lv_new_id.

      IF sy-subrc = 0.
        " Bước B: Lấy Steps
        SELECT * FROM tbtcp
          INTO TABLE @lt_steps
          WHERE jobname  = @ls_key-JobName
            AND jobcount = @lv_source_count.

        " Bước C: Đổ vào Job mới (Chỉ chạy nếu có Steps)
        IF lt_steps IS NOT INITIAL.
          LOOP AT lt_steps INTO DATA(ls_step).
            CALL FUNCTION 'JOB_SUBMIT'
              EXPORTING
                authcknam = sy-uname
                jobcount  = lv_new_id
                jobname   = lv_target_name
                report    = ls_step-progname
                variant   = ls_step-variant.
          ENDLOOP.
        ENDIF.

        " Bước D: Đóng Job
        CALL FUNCTION 'JOB_CLOSE' EXPORTING jobcount = lv_new_id jobname = lv_target_name.

        " Gửi thông báo thành công
        APPEND VALUE #( %tky = ls_key-%tky
                        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-success
                                                      text = |👯 Đã nhân bản thành Job: { lv_target_name }| )
                      ) TO reported-joblist.
      ENDIF.
    ENDLOOP.

    " --- ĐOẠN SỬA LỖI PROVIDER ERROR ---
    " Trong Action có tham số, UI mong đợi result chứa dữ liệu của các dòng gốc (keys)
    READ ENTITIES OF z_i_backgroundjob IN LOCAL MODE
      ENTITY JobList ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(lt_refreshed).

    " Luôn đảm bảo result không được rỗng và khớp với số lượng dòng trong keys
    result = VALUE #( FOR res IN lt_refreshed (
        %tky   = res-%tky
        %param = res
    ) ).

  ENDMETHOD.

  METHOD read.
    LOOP AT keys INTO DATA(ls_key).
      SELECT SINGLE *
        FROM z_i_backgroundjob
        WHERE JobName  = @ls_key-JobName
          AND JobCount = @ls_key-JobCount
        INTO @DATA(ls_job).

      IF sy-subrc = 0.
        INSERT CORRESPONDING #( ls_job ) INTO TABLE result.
      ELSE.
        APPEND VALUE #( %tky = ls_key-%tky ) TO failed-joblist.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD lock.
  ENDMETHOD.

  METHOD ScheduleJob.
    DATA: lv_jobcount     TYPE tbtcjob-jobcount,
          lv_jobname      TYPE tbtcjob-jobname,
          ls_print_params TYPE pri_params,
          lv_sdlstrtdt    TYPE tbtcjob-sdlstrtdt,
          lv_sdlstrttm    TYPE tbtcjob-sdlstrttm.

    DATA: lv_report   TYPE sy-repid,
          lv_variant  TYPE raldb-variant,
          lv_msg_text TYPE string.

    DATA: lv_prdmins   TYPE tbtco-prdmins,
          lv_prdhours  TYPE tbtco-prdhours,
          lv_prddays   TYPE tbtco-prddays,
          lv_prdweeks  TYPE tbtco-prdweeks,
          lv_prdmonths TYPE tbtco-prdmonths,
          lv_period    TYPE tbtco-periodic.

    " 1. Lấy tham số
    READ TABLE keys INTO DATA(ls_key) INDEX 1.
    DATA(ls_params) = ls_key-%param.

    lv_jobname = ls_params-JobName.
    lv_report  = ls_params-ProgramName.
    lv_variant = ls_params-VariantName.

    DATA(lv_freq_val) = COND #( WHEN ls_params-FrequencyValue IS INITIAL
                                THEN 1
                                ELSE ls_params-FrequencyValue ).

    CASE ls_params-FrequencyType.
      WHEN 'MINUTES'.
        lv_prdmins   = lv_freq_val.
        lv_period    = 'X'.
      WHEN 'HOURLY'.
        lv_prdhours   = lv_freq_val.
        lv_period    = 'X'.
      WHEN 'DAILY'.
        lv_prddays   = lv_freq_val.
        lv_period    = 'X'.
      WHEN 'WEEKLY'.
        lv_prdweeks  = lv_freq_val.
        lv_period    = 'X'.
      WHEN 'MONTHLY'.
        lv_prdmonths = lv_freq_val.
        lv_period    = 'X'.
      WHEN OTHERS.
        CLEAR lv_period.
    ENDCASE.

    " 2. JOB OPEN
    CALL FUNCTION 'JOB_OPEN'
      EXPORTING
        jobname          = lv_jobname
      IMPORTING
        jobcount         = lv_jobcount
      EXCEPTIONS
        cant_create_job  = 1
        invalid_job_data = 2
        jobname_missing  = 3
        OTHERS           = 4.
    IF sy-subrc <> 0.
      lv_msg_text = |Lỗi khởi tạo Job: { lv_jobname }|.
      INSERT VALUE #( %cid = ls_key-%cid
                      %msg = new_message_with_text( text = lv_msg_text severity = if_abap_behv_message=>severity-error )
                    ) INTO TABLE reported-joblist.
      INSERT VALUE #( %cid = ls_key-%cid ) INTO TABLE failed-joblist.
      RETURN.
    ENDIF.

    CALL FUNCTION 'GET_PRINT_PARAMETERS'
      EXPORTING
        no_dialog      = 'X'
      IMPORTING
        out_parameters = ls_print_params.

    CALL FUNCTION 'JOB_SUBMIT'
      EXPORTING
        authcknam       = sy-uname
        jobcount        = lv_jobcount
        jobname         = lv_jobname
        report          = lv_report
        variant         = lv_variant
        priparams       = ls_print_params
      EXCEPTIONS
        bad_priparams   = 1
        jobname_missing = 2
        job_notex       = 3
        program_missing = 4
        OTHERS          = 5.
    IF sy-subrc <> 0.
      CASE sy-subrc.
        WHEN 4.
          lv_msg_text = |Program '{ lv_report }' không tồn tại.|.
        WHEN OTHERS.
          lv_msg_text = |Lỗi khi submit Job (Program: { lv_report }, Variant: { lv_variant }). RC={ sy-subrc }|.
      ENDCASE.

      INSERT VALUE #( %cid = ls_key-%cid
                      %msg = new_message_with_text( text = lv_msg_text severity = if_abap_behv_message=>severity-error )
                    ) INTO TABLE reported-joblist.
      INSERT VALUE #( %cid = ls_key-%cid ) INTO TABLE failed-joblist.
      RETURN.
    ENDIF.

    IF ls_params-IsImmediate = abap_true.
      CALL FUNCTION 'JOB_CLOSE'
        EXPORTING
          jobcount  = lv_jobcount
          jobname   = lv_jobname
          strtimmed = 'X'
          prdmins   = lv_prdmins
          prdhours  = lv_prdhours
          prddays   = lv_prddays
          prdweeks  = lv_prdweeks
          prdmonths = lv_prdmonths
        EXCEPTIONS
          OTHERS    = 1.
    ELSE.
      lv_sdlstrtdt = ls_params-StartDate.
      lv_sdlstrttm = ls_params-StartTime.

      CALL FUNCTION 'JOB_CLOSE'
        EXPORTING
          jobcount  = lv_jobcount
          jobname   = lv_jobname
          sdlstrtdt = lv_sdlstrtdt
          sdlstrttm = lv_sdlstrttm
          prdmins   = lv_prdmins
          prdhours  = lv_prdhours
          prddays   = lv_prddays
          prdweeks  = lv_prdweeks
          prdmonths = lv_prdmonths
        EXCEPTIONS
          OTHERS    = 1.
    ENDIF.

    IF sy-subrc <> 0.
      " Xử lý lỗi Close
      lv_msg_text = |Lỗi khi Close Job. RC={ sy-subrc }|.
      INSERT VALUE #( %cid = ls_key-%cid
                      %msg = new_message_with_text( text = lv_msg_text severity = if_abap_behv_message=>severity-error )
                    ) INTO TABLE reported-joblist.
      INSERT VALUE #( %cid = ls_key-%cid ) INTO TABLE failed-joblist.
      RETURN.
    ENDIF.

    " Gán Result để UI refresh (với Create Action thì dùng %cid)
    result = VALUE #( ( %cid = ls_key-%cid ) ).

    lv_msg_text = |Job '{ lv_jobname }' đã được tạo thành công (ID: { lv_jobcount }).|.

    IF ls_params-IsImmediate = abap_true.
      lv_msg_text = lv_msg_text && | Trạng thái: Chạy ngay.|.
    ELSE.
      lv_msg_text = lv_msg_text && | Bắt đầu: { ls_params-StartDate DATE = USER } { ls_params-StartTime TIME = USER }.|.
    ENDIF.

    INSERT VALUE #( %cid = ls_key-%cid
                    %msg = new_message_with_text( text = lv_msg_text severity = if_abap_behv_message=>severity-success )
                  ) INTO TABLE reported-joblist.

  ENDMETHOD.

  " --- METHOD DELETE ĐÃ ĐƯỢC CHỈNH SỬA HOÀN CHỈNH ---
  METHOD DeleteJob.

    LOOP AT keys INTO DATA(ls_key).

      " Gọi hàm xóa với commitmode = space (KHÔNG COMMIT) để tránh lỗi RAP
      CALL FUNCTION 'BP_JOB_DELETE'
        EXPORTING
          jobcount   = ls_key-JobCount
          jobname    = ls_key-JobName
          forcedmode = 'X'
          commitmode = space
        EXCEPTIONS
          OTHERS     = 1.

      IF sy-subrc <> 0.
        " --- TRƯỜNG HỢP LỖI ---
        APPEND VALUE #( %tky = ls_key-%tky ) TO failed-joblist.

        IF sy-msgid IS NOT INITIAL.
          " Lỗi từ hệ thống (có ID)
          APPEND VALUE #(
              %tky = ls_key-%tky
              %msg = new_message(
                       id       = sy-msgid
                       number   = sy-msgno
                       v1       = sy-msgv1
                       v2       = sy-msgv2
                       v3       = sy-msgv3
                       v4       = sy-msgv4
                       severity = if_abap_behv_message=>severity-error )
          ) TO reported-joblist.
        ELSE.
          " Lỗi chung
          APPEND VALUE #(
              %tky = ls_key-%tky
              %msg = new_message_with_text(
                       text     = |Lỗi xóa Job (RC={ sy-subrc }). Vui lòng kiểm tra SM37.|
                       severity = if_abap_behv_message=>severity-error )
          ) TO reported-joblist.
        ENDIF.

      ELSE.
        " --- TRƯỜNG HỢP THÀNH CÔNG ---

        " 1. Thông báo thành công
        APPEND VALUE #(
            %tky = ls_key-%tky
            %msg = new_message(
                     id       = 'SY'
                     number   = 499
                     v1       = |Đã xóa thành công Job: { ls_key-JobName }|
                     severity = if_abap_behv_message=>severity-success )
        ) TO reported-joblist.

        " 2. QUAN TRỌNG: Đọc lại data mới nhất từ DB rồi gán vào Result
        SELECT SINGLE *
          FROM z_i_backgroundjob
          WHERE JobName  = @ls_key-JobName
            AND JobCount = @ls_key-JobCount
          INTO @DATA(ls_refreshed).

        IF sy-subrc = 0.
          APPEND VALUE #( %tky   = ls_key-%tky
                          %param = CORRESPONDING #( ls_refreshed ) ) TO result.
        ELSE.
          " Job đã bị xóa thực sự, vẫn gán result để UI biết xóa thành công
          APPEND VALUE #( %tky   = ls_key-%tky
                          %param = CORRESPONDING #( ls_key ) ) TO result.
        ENDIF.

      ENDIF.

    ENDLOOP.
  ENDMETHOD.

  " --- METHOD STOP JOB ---
  METHOD StopJob.

    LOOP AT keys INTO DATA(ls_key).

      " 1. GỌI HÀM STOP JOB (CANCEL ACTIVE)
      " Hàm này sẽ hủy Job đang chạy ngay lập tức
      CALL FUNCTION 'BP_JOB_ABORT'
        EXPORTING
          jobcount                   = ls_key-JobCount
          jobname                    = ls_key-JobName
        EXCEPTIONS
          checking_of_job_has_failed = 1
          job_does_not_exist         = 2
          job_is_not_active          = 3
          OTHERS                     = 4.

      IF sy-subrc <> 0.
        " --- XỬ LÝ LỖI ---
        APPEND VALUE #( %tky = ls_key-%tky ) TO failed-joblist.

        DATA(lv_msg_text) = |Lỗi Stop Job (RC={ sy-subrc }). |.

        " Phân loại lỗi cho người dùng dễ hiểu
        CASE sy-subrc.
          WHEN 3.
            lv_msg_text = lv_msg_text && |Job không đang chạy (Not Active), không thể Stop.|.
          WHEN OTHERS.
            lv_msg_text = lv_msg_text && |Vui lòng kiểm tra SM37.|.
        ENDCASE.

        APPEND VALUE #(
            %tky = ls_key-%tky
            %msg = new_message_with_text(
                     text     = lv_msg_text
                     severity = if_abap_behv_message=>severity-error )
        ) TO reported-joblist.

      ELSE.
        " --- THÀNH CÔNG ---

        " 1. Báo message thành công
        APPEND VALUE #(
            %tky = ls_key-%tky
            %msg = new_message(
                     id       = 'SY'
                     number   = 499
                     v1       = |Đã gửi lệnh Stop cho Job: { ls_key-JobName }|
                     severity = if_abap_behv_message=>severity-success )
        ) TO reported-joblist.

        " 2. QUAN TRỌNG: Đọc lại data mới nhất từ DB rồi gán vào Result
        SELECT SINGLE *
          FROM z_i_backgroundjob
          WHERE JobName  = @ls_key-JobName
            AND JobCount = @ls_key-JobCount
          INTO @DATA(ls_refreshed2).

        IF sy-subrc = 0.
          APPEND VALUE #( %tky   = ls_key-%tky
                          %param = CORRESPONDING #( ls_refreshed2 ) ) TO result.
        ELSE.
          APPEND VALUE #( %tky   = ls_key-%tky
                          %param = CORRESPONDING #( ls_key ) ) TO result.
        ENDIF.

      ENDIF.

    ENDLOOP.

  ENDMETHOD.
ENDCLASS.

" --- CLASS SAVER GIỮ NGUYÊN ---
CLASS lsc_Z_I_BACKGROUNDJOB DEFINITION INHERITING FROM cl_abap_behavior_saver.
  PROTECTED SECTION.
    METHODS finalize REDEFINITION.
    METHODS check_before_save REDEFINITION.
    METHODS save REDEFINITION.
    METHODS cleanup REDEFINITION.
    METHODS cleanup_finalize REDEFINITION.
ENDCLASS.

CLASS lsc_Z_I_BACKGROUNDJOB IMPLEMENTATION.
  METHOD finalize.
  ENDMETHOD.

  METHOD check_before_save.
  ENDMETHOD.

  METHOD save.
  ENDMETHOD.

  METHOD cleanup.
  ENDMETHOD.

  METHOD cleanup_finalize.
  ENDMETHOD.
ENDCLASS.