$('.header-nav-toggle').click(function () {
    $('body').toggleClass('nav-out');
});

$('.header-nav a').click(function () {
    $('body').removeClass('nav-out');
})
