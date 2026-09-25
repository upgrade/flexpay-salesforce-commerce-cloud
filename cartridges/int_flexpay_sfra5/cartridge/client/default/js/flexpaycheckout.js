'use strict';

var scrollAnimate = require('base/components/scrollAnimate');

$(function () {
    $(document).on('click', '.place-order', function (e) {
        if ($('.payment-information').data('payment-method-id') === 'FLEXPAY') {
            $('body').trigger('checkout:disableButton', '.next-step-button button');
            $.spinner().start();
            
            $('.alert.error-message p.error-message-text').remove();
            $.ajax({
                url: $('#flexpay-data').data('placeorder-url') + '?' + $('#flexpay-data').data('csrfname') + '=' + $('#flexpay-data').data('csrftoken'),
                type: 'post',
                success: function (data) {
                    if (data.error) {
                        // show error and enable the placeOrder button here
                        $.spinner().stop();
                        $('body').trigger('checkout:enableButton', '.next-step-button button');
                        $('.error-message').show();
                        $('.error-message').text(data.errorMessage);
                        scrollAnimate($('.error-message'));
                    } else {
                        // Spinner will stop when page redirects
                        window.location.href = data.redirectUrl;
                    }
                },
                error: function () {
                    // enable the placeOrder button here
                    $.spinner().stop();
                    $('body').trigger('checkout:enableButton', '.next-step-button button');
                }
            });
            e.preventDefault();
        }
    });
});
