// Web Controller - Handles public pages

exports.index = (req, res) => {
    res.render('index', {
        title: 'Infranexia - Program Magang',
        currentPage: 'home'
    });
};

exports.faq = (req, res) => {
    res.render('faq', {
        title: 'FAQ - Infranexia',
        currentPage: 'faq'
    });
};

exports.program = (req, res) => {
    res.render('program', {
        title: 'Program - Infranexia',
        currentPage: 'program'
    });
};
